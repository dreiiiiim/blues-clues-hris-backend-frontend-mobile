import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class SuperAdminCompaniesService {
  constructor(private readonly supabase: SupabaseService) {}

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
         billing_cycle, payment_date, transaction_id,
         company(company_name, slug)`,
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

    await db.from('admin_audit_logs').insert({
      action: `STATUS_UPDATE: registration ${registrationId} → ${subscriptionStatus}`,
      performed_by: performedBy,
      severity: 'INFO',
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
    if (reg.company_id) throw new BadRequestException('Company already provisioned');

    const companyId = crypto.randomUUID();
    const slug = reg.company_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    await db.from('company').insert({ company_id: companyId, company_name: reg.company_name, slug });
    await db.from('company_registrations')
      .update({ company_id: companyId, status: 'Provisioned' })
      .eq('registration_id', registrationId);
    await db.from('tenant_config').insert({
      company_id: companyId, timezone: 'Asia/Manila', date_format: 'MM/DD/YYYY', currency: 'PHP',
    });
    await db.from('admin_audit_logs').insert({
      action: `PROVISION: ${reg.company_name} (${companyId}) — registration ${registrationId}`,
      performed_by: performedBy,
      company_id: companyId,
      severity: 'INFO',
    });

    return { company_id: companyId };
  }
}
