import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';
import { SupabaseService } from '../../supabase/supabase.service';
import { MailService } from '../../mail/mail.service';

@Injectable()
export class SuperAdminCompaniesService {
  private readonly logger = new Logger(SuperAdminCompaniesService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  async list(query: {
    status?: string; plan?: string; industry?: string;
    from?: string; to?: string; page?: number; limit?: number;
  }) {
    const db = this.supabase.getClient();
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    let q = db
      .from('company_registrations')
      .select(
        `registration_id, company_id, company_name, email, industry,
         subscription_plan, subscription_status, payment_status,
         billing_cycle, payment_date, transaction_id, invite_url`,
        { count: 'exact' },
      )
      .range(offset, offset + limit - 1)
      .order('registered_date', { ascending: false });

    if (query.status) q = q.ilike('subscription_status', query.status);
    if (query.plan) q = q.eq('subscription_plan', query.plan);
    if (query.industry) q = q.ilike('industry', `%${query.industry}%`);
    if (query.from) q = q.gte('payment_date', query.from);
    if (query.to) q = q.lte('payment_date', query.to);

    const { data, error, count } = await q;
    if (error) throw new BadRequestException(error.message);
    return { data, total: count, page, limit };
  }

  async detail(companyId: string) {
    const db = this.supabase.getClient();
    const [reg, config, modules] = await Promise.all([
      db.from('company_registrations').select('*').eq('company_id', companyId).maybeSingle(),
      db.from('tenant_config').select('*').eq('company_id', companyId).maybeSingle(),
      db.from('tenant_modules').select('*').eq('company_id', companyId),
    ]);
    if (!reg.data) throw new NotFoundException('Company not found');
    return { registration: reg.data, config: config.data, modules: modules.data };
  }

  async updateStatus(registrationId: string, subscriptionStatus: string, performedBy: string) {
    const db = this.supabase.getClient();
    const { error } = await db
      .from('company_registrations')
      .update({ subscription_status: subscriptionStatus })
      .eq('registration_id', registrationId);
    if (error) throw new BadRequestException(error.message);

    db.from('admin_audit_logs').insert({
      action: `STATUS_UPDATE: registration ${registrationId} → ${subscriptionStatus}`,
      performed_by: null,
      severity: 'INFO',
    }).then(({ error: auditErr }) => {
      if (auditErr) this.logger.warn(`Audit log failed: ${auditErr.message}`);
    });
    return { success: true };
  }

  async provision(registrationId: string, performedBy: string) {
    const db = this.supabase.getClient();
    const { data: reg, error } = await db
      .from('company_registrations')
      .select('*')
      .eq('registration_id', registrationId)
      .maybeSingle();

    if (error || !reg) throw new NotFoundException('Registration not found');
    if (reg.payment_status !== 'Paid') throw new BadRequestException('Payment not yet confirmed');
    if (reg.company_id) throw new BadRequestException('Company already provisioned');

    const companyId = crypto.randomUUID();
    const slug = reg.company_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    await db.from('company').insert({ company_id: companyId, company_name: reg.company_name, slug });
    await db.from('company_registrations')
      .update({ company_id: companyId, subscription_status: 'Active' })
      .eq('registration_id', registrationId);
    await db.from('tenant_config').insert({
      company_id: companyId, timezone: 'Asia/Manila', date_format: 'MM/DD/YYYY', currency: 'PHP',
    });

    // Seed default departments + roles
    await this.seedDefaults(companyId);

    // Create System Admin role + user for the subscriber
    const roleId = await this.getOrCreateSystemAdminRole(companyId);
    const userId = crypto.randomUUID();
    const employeeId = `sa-${companyId.slice(0, 8)}`;

    const { error: userErr } = await db.from('user_profile').insert({
      user_id: userId,
      email: reg.email,
      first_name: 'System',
      last_name: 'Admin',
      role_id: roleId,
      company_id: companyId,
      employee_id: employeeId,
      username: null,
      password_hash: null,
      account_status: 'Pending',
    });

    if (userErr) {
      throw new InternalServerErrorException(`System Admin user creation failed: ${userErr.message}`);
    }

    await db.from('user_role_assignments').upsert(
      { user_id: userId, role_id: roleId, is_primary: true, is_active: true },
      { onConflict: 'user_id,role_id' },
    );
    await db.from('role_portal_map').upsert(
      { role_id: roleId, portal_key: 'system-admin' },
      { onConflict: 'role_id,portal_key' },
    );

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    const { error: inviteErr } = await db.from('user_invites').insert({
      invite_id: crypto.randomUUID(),
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    if (inviteErr) {
      throw new InternalServerErrorException(`Invite creation failed: ${inviteErr.message}`);
    }

    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:3001';
    const inviteLink = `${appUrl}/set-password?token=${rawToken}`;

    this.logger.debug(`DEV: System Admin invite for ${reg.email} → ${inviteLink}`);

    await db.from('company_registrations')
      .update({ invite_url: inviteLink })
      .eq('registration_id', registrationId);

    this.mailService.sendSystemAdminCredentials(reg.email, inviteLink).catch((err: unknown) => {
      this.logger.error(`Failed to send System Admin invite to ${reg.email}`, err);
    });

    db.from('admin_audit_logs').insert({
      action: `PROVISION: ${reg.company_name} (${companyId}) — registration ${registrationId}`,
      performed_by: null,
      company_id: companyId,
      severity: 'INFO',
    }).then(({ error: auditErr }) => {
      if (auditErr) this.logger.warn(`Audit log failed: ${auditErr.message}`);
    });

    return { company_id: companyId, slug, invite_link: inviteLink };
  }

  private async seedDefaults(companyId: string): Promise<void> {
    const db = this.supabase.getClient();

    const DEFAULT_DEPARTMENTS = ['General', 'IT', 'HR', 'Finance', 'Operations'];
    const DEFAULT_ROLES: { name: string; portal: string }[] = [
      { name: 'Admin',                                       portal: 'admin' },
      { name: 'HR Officer',                                  portal: 'hr' },
      { name: 'HR Recruiter',                                portal: 'hr' },
      { name: 'HR Interviewer',                              portal: 'hr' },
      { name: 'Manager',                                     portal: 'manager' },
      { name: 'Employee',                                    portal: 'employee' },
      { name: 'HR Onboarding Officer',                       portal: 'hr' },
      { name: 'HR Compensation and Benefits Officer',        portal: 'hr' },
      { name: 'HR Performance Management Officer',           portal: 'hr' },
      { name: 'HR Offboarding Officer/Coordinator',          portal: 'hr' },
    ];

    // Departments — skip if already seeded
    const { data: existingDepts } = await db
      .from('department')
      .select('department_name')
      .eq('company_id', companyId);

    if (!existingDepts || existingDepts.length === 0) {
      await db.from('department').insert(
        DEFAULT_DEPARTMENTS.map((name) => ({ department_name: name, company_id: companyId })),
      );
    }

    // Roles — insert only missing ones, then map portals
    const { data: existingRoles } = await db
      .from('role')
      .select('role_name')
      .eq('company_id', companyId);

    const existingNames = new Set((existingRoles ?? []).map((r: { role_name: string }) => r.role_name));
    const toInsert = DEFAULT_ROLES.filter((r) => !existingNames.has(r.name));

    if (toInsert.length > 0) {
      const { data: inserted, error: roleInsertErr } = await db
        .from('role')
        .insert(toInsert.map((r) => ({ role_name: r.name, company_id: companyId })))
        .select('role_id, role_name');

      if (roleInsertErr) {
        this.logger.warn(`Default role seed partial failure: ${roleInsertErr.message}`);
      }

      if (inserted && inserted.length > 0) {
        const portalMap = new Map(DEFAULT_ROLES.map((r) => [r.name, r.portal]));
        const mappings = inserted
          .filter((r: { role_id: string; role_name: string }) => portalMap.has(r.role_name))
          .map((r: { role_id: string; role_name: string }) => ({
            role_id: r.role_id,
            portal_key: portalMap.get(r.role_name)!,
          }));

        if (mappings.length > 0) {
          await db.from('role_portal_map').upsert(mappings, { onConflict: 'role_id,portal_key' });
        }
      }
    }
  }

  private async getOrCreateSystemAdminRole(companyId: string): Promise<string> {
    const db = this.supabase.getClient();

    const { data: existing, error: lookupErr } = await db
      .from('role')
      .select('role_id')
      .eq('company_id', companyId)
      .ilike('role_name', 'system admin')
      .limit(1)
      .maybeSingle();

    if (lookupErr) {
      throw new InternalServerErrorException(`Role lookup failed: ${lookupErr.message}`);
    }
    if (existing?.role_id) return existing.role_id;

    const { data: inserted, error: insertErr } = await db
      .from('role')
      .insert({ role_name: 'System Admin', company_id: companyId })
      .select('role_id')
      .single();

    if (insertErr || !inserted?.role_id) {
      throw new InternalServerErrorException(
        `System Admin role creation failed: ${insertErr?.message ?? 'Unknown error'}`,
      );
    }

    return inserted.role_id;
  }
}
