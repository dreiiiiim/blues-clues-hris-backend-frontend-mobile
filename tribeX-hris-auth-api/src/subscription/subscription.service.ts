import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';
import { MailService } from '../mail/mail.service';
import { SupabaseService } from '../supabase/supabase.service';
import { PaymentConfirmDto } from './dto/payment-confirm.dto';
import { RegisterCompanyDto } from './dto/register-company.dto';
import { SelectPlanDto } from './dto/select-plan.dto';

const MODULES = [
  'recruitment',
  'onboarding',
  'compensation',
  'performance',
  'offboarding',
] as const;

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');
}

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  getPlans() {
    return [
      {
        plan_id: 'monthly',
        name: 'Monthly Plan',
        billing_cycle: 'monthly',
        price_php: 2999,
      },
      {
        plan_id: 'annual',
        name: 'Annual Plan',
        billing_cycle: 'annual',
        price_php: 29999,
      },
    ];
  }

  async register(dto: RegisterCompanyDto) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('company_registrations')
      .insert({
        company_name: dto.company_name.trim(),
        address: dto.address,
        contact: dto.contact,
        email: dto.email.trim().toLowerCase(),
        industry: dto.industry,
        nature_of_business: dto.nature_of_business,
        tin: dto.tin,
        business_permit_url: dto.business_permit_url ?? null,
        registration_cert_url: dto.registration_cert_url ?? null,
        hr_org_structure: dto.hr_org_structure ?? null,
        status: 'Registered',
        payment_status: 'Pending',
        subscription_status: 'Pending',
      })
      .select('registration_id')
      .single();

    if (error) throw new InternalServerErrorException(error.message);

    this.mailService
      .sendRegistrationConfirmation(dto.email, dto.company_name)
      .catch((err) => {
        this.logger.error(
          `Failed to send registration confirmation to ${dto.email}`,
          err,
        );
      });

    return {
      registration_id: data.registration_id,
      message: 'Registration submitted. Check your email for confirmation.',
    };
  }

  async selectPlan(dto: SelectPlanDto) {
    const supabase = this.supabaseService.getClient();

    const { data: existing, error: fetchErr } = await supabase
      .from('company_registrations')
      .select('registration_id, payment_status')
      .eq('registration_id', dto.registration_id)
      .maybeSingle();

    if (fetchErr) throw new InternalServerErrorException(fetchErr.message);
    if (!existing) throw new NotFoundException('Registration not found');
    if (existing.payment_status === 'Paid') {
      throw new BadRequestException(
        'Payment already completed for this registration',
      );
    }

    const { data, error } = await supabase
      .from('company_registrations')
      .update({
        subscription_plan: dto.subscription_plan,
        billing_cycle: dto.billing_cycle,
      })
      .eq('registration_id', dto.registration_id)
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  async getRegistrationStatus(registrationId: string) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('company_registrations')
      .select(
        'registration_id, payment_status, subscription_status, subscription_plan, company_name',
      )
      .eq('registration_id', registrationId)
      .maybeSingle();

    if (error) throw new InternalServerErrorException(error.message);
    if (!data) throw new NotFoundException('Registration not found');
    return data;
  }

  async confirmPayment(dto: PaymentConfirmDto, webhookSecret: string) {
    const expectedSecret = this.config.get<string>('SUBSCRIPTION_WEBHOOK_SECRET') ?? '';
    let secretValid = false;
    try {
      secretValid = crypto.timingSafeEqual(
        Buffer.from(webhookSecret ?? ''),
        Buffer.from(expectedSecret),
      );
    } catch {
      secretValid = false;
    }
    if (!secretValid) throw new UnauthorizedException('Invalid webhook secret');

    const supabase = this.supabaseService.getClient();

    const { data: registration, error: fetchErr } = await supabase
      .from('company_registrations')
      .select('*')
      .eq('registration_id', dto.registration_id)
      .maybeSingle();

    if (fetchErr) throw new InternalServerErrorException(fetchErr.message);
    if (!registration) throw new NotFoundException('Registration not found');

    if (registration.payment_status === 'Paid') {
      if (registration.company_id) {
        return {
          message: 'Already processed',
          registration_id: dto.registration_id,
        };
      }

      await this.provisionTenant(registration);
      return {
        message: 'Payment already marked paid. Tenant provisioning completed.',
        registration_id: dto.registration_id,
      };
    }

    const { data: dupeTxn } = await supabase
      .from('company_registrations')
      .select('registration_id')
      .eq('transaction_id', dto.transaction_id)
      .neq('registration_id', dto.registration_id)
      .maybeSingle();

    if (dupeTxn) {
      throw new ConflictException(
        'Transaction ID already used by another registration',
      );
    }

    const { error: paymentErr } = await supabase
      .from('company_registrations')
      .update({
        payment_status: 'Paid',
        payment_date: new Date().toISOString(),
        transaction_id: dto.transaction_id,
        subscription_status: 'Active',
      })
      .eq('registration_id', dto.registration_id);

    if (paymentErr) throw new InternalServerErrorException(paymentErr.message);

    await this.provisionTenant({ ...registration, payment_status: 'Paid' });

    return {
      message: 'Payment confirmed. Tenant provisioned.',
      registration_id: dto.registration_id,
    };
  }

  private async provisionTenant(registration: Record<string, any>) {
    const supabase = this.supabaseService.getClient();

    const slug = generateSlug(registration.company_name);
    const { data: company, error: companyErr } = await supabase
      .from('company')
      .insert({ company_name: registration.company_name, slug })
      .select('company_id')
      .single();

    if (companyErr) {
      throw new InternalServerErrorException(
        `Company creation failed: ${companyErr.message}`,
      );
    }
    const { company_id } = company;

    await supabase
      .from('company_registrations')
      .update({ company_id })
      .eq('registration_id', registration.registration_id);

    await supabase.from('tenant_config').insert({
      company_id,
      timezone: 'Asia/Manila',
      date_format: 'MM/DD/YYYY',
      currency: 'PHP',
    });

    await supabase.from('tenant_modules').upsert(
      MODULES.map((module) => ({ company_id, module, status: 'Active' })),
      { onConflict: 'company_id,module' },
    );

    const roleId = await this.getOrCreateSystemAdminRole(company_id);

    const user_id = crypto.randomUUID();
    const employee_id = `sa-${company_id.slice(0, 8)}`;

    const { error: userErr } = await supabase.from('user_profile').insert({
      user_id,
      email: registration.email,
      first_name: 'System',
      last_name: 'Admin',
      role_id: roleId,
      company_id,
      employee_id,
      username: null,
      password_hash: null,
      account_status: 'Pending',
    });

    if (userErr) {
      throw new InternalServerErrorException(
        `System Admin user creation failed: ${userErr.message}`,
      );
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    const { error: inviteErr } = await supabase.from('user_invites').insert({
      invite_id: crypto.randomUUID(),
      user_id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    if (inviteErr) {
      throw new InternalServerErrorException(
        `Invite creation failed: ${inviteErr.message}`,
      );
    }

    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:3000';
    const inviteLink = `${appUrl}/set-password?token=${rawToken}`;

    if (this.config.get<string>('NODE_ENV') !== 'production') {
      this.logger.debug(
        `DEV MODE - System Admin invite | Email: ${registration.email} | Link: ${inviteLink}`,
      );
    }

    this.mailService
      .sendPaymentConfirmation(
        registration.email,
        registration.company_name,
        registration.subscription_plan,
      )
      .catch((err) => {
        this.logger.error(
          `Failed to send payment confirmation to ${registration.email}`,
          err,
        );
      });

    this.mailService
      .sendSystemAdminCredentials(registration.email, inviteLink)
      .catch((err) => {
        this.logger.error(
          `Failed to send System Admin credentials to ${registration.email}`,
          err,
        );
      });

    try {
      await supabase.from('admin_audit_logs').insert({
        action: `TENANT_PROVISIONED: ${registration.company_name} (${company_id})`,
        performed_by: null,
        company_id,
        target_user_id: user_id,
        severity: 'WARNING',
        ip_address: null,
      });
    } catch {
      // non-fatal
    }
  }

  private async getOrCreateSystemAdminRole(companyId: string): Promise<string> {
    const supabase = this.supabaseService.getClient();

    const { data: globalRole, error: globalRoleErr } = await supabase
      .from('role')
      .select('role_id')
      .is('company_id', null)
      .ilike('role_name', 'system admin')
      .limit(1)
      .maybeSingle();

    if (globalRoleErr) {
      throw new InternalServerErrorException(
        `Role lookup failed: ${globalRoleErr.message}`,
      );
    }
    if (globalRole?.role_id) {
      return globalRole.role_id;
    }

    const { data: tenantRole, error: tenantRoleErr } = await supabase
      .from('role')
      .select('role_id')
      .eq('company_id', companyId)
      .ilike('role_name', 'system admin')
      .limit(1)
      .maybeSingle();

    if (tenantRoleErr) {
      throw new InternalServerErrorException(
        `Role lookup failed: ${tenantRoleErr.message}`,
      );
    }
    if (tenantRole?.role_id) {
      return tenantRole.role_id;
    }

    const { data: insertedRole, error: insertRoleErr } = await supabase
      .from('role')
      .insert({
        role_name: 'System Admin',
        company_id: companyId,
      })
      .select('role_id')
      .single();

    if (insertRoleErr || !insertedRole?.role_id) {
      throw new InternalServerErrorException(
        `System Admin role creation failed: ${insertRoleErr?.message ?? 'Unknown error'}`,
      );
    }

    return insertedRole.role_id;
  }
}
