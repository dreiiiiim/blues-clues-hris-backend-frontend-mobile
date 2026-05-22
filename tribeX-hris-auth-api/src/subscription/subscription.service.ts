import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';
import { PaymentCheckoutSession } from '@implementsprint/sdk';
import { ApiCenterSdkService } from '../api-center/api-center-sdk.service';
import { MailService } from '../mail/mail.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { PaymentConfirmDto } from './dto/payment-confirm.dto';
import { RegisterCompanyDto } from './dto/register-company.dto';
import { SelectPlanDto } from './dto/select-plan.dto';


@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
    private readonly apiCenterSdkService: ApiCenterSdkService,
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

  async createCheckout(dto: CreateCheckoutDto): Promise<{ checkout_url: string; checkout_id: string }> {
    const supabase = this.supabaseService.getClient();

    const { data: registration, error: fetchErr } = await supabase
      .from('company_registrations')
      .select('registration_id, payment_status, subscription_plan, billing_cycle, company_name, email')
      .eq('registration_id', dto.registration_id)
      .maybeSingle();

    if (fetchErr) throw new InternalServerErrorException(fetchErr.message);
    if (!registration) throw new NotFoundException('Registration not found');
    if (registration.payment_status === 'Paid') {
      throw new BadRequestException('Payment already completed for this registration');
    }

    const isAnnual = (registration.subscription_plan ?? registration.billing_cycle) === 'annual';
    const amountCentavos = isAnnual ? 2999900 : 299900; // ₱29,999 or ₱2,999
    const planName = isAnnual ? 'Annual Plan' : 'Monthly Plan';

    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:3000';
    const successUrl = `${appUrl}/payment/success?registration_id=${dto.registration_id}`;
    const cancelUrl = `${appUrl}/payment/cancel?registration_id=${dto.registration_id}`;

    const session = await this.apiCenterSdkService
      .getClient()
      .paymentCreateCheckoutSession({
        referenceId: dto.registration_id,
        idempotencyKey: dto.registration_id,
        successUrl,
        cancelUrl,
        lineItems: [
          {
            name: planName,
            quantity: 1,
            amount: { value: amountCentavos, currency: 'PHP' },
          },
        ],
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`paymentCreateCheckoutSession failed: ${message}`);
        throw new InternalServerErrorException(`Payment gateway error: ${message}`);
      });

    const checkoutId = session.checkoutId;
    const checkoutUrl = session.redirectUrl;

    const { error: updateErr } = await supabase
      .from('company_registrations')
      .update({ checkout_id: checkoutId })
      .eq('registration_id', dto.registration_id);

    if (updateErr) throw new InternalServerErrorException(updateErr.message);

    return { checkout_url: checkoutUrl, checkout_id: checkoutId };
  }

  async confirmPayment(dto: PaymentConfirmDto) {
    const supabase = this.supabaseService.getClient();

    const { data: registration, error: fetchErr } = await supabase
      .from('company_registrations')
      .select('*')
      .eq('registration_id', dto.registration_id)
      .maybeSingle();

    if (fetchErr) throw new InternalServerErrorException(fetchErr.message);
    if (!registration) throw new NotFoundException('Registration not found');
    if (!registration.checkout_id) {
      throw new BadRequestException(
        'Missing checkout session for this registration',
      );
    }

    if (registration.payment_status === 'Paid') {
      return {
        message: 'Payment already recorded. Awaiting super admin provisioning.',
        registration_id: dto.registration_id,
      };
    }

    // PayMongo confirms async via webhook → API Center → status update.
    // Poll up to 5x with 2s delay to give the webhook time to process.
    const MAX_ATTEMPTS = 5;
    const POLL_INTERVAL_MS = 2000;
    let checkoutSession: PaymentCheckoutSession | undefined;
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      checkoutSession = await this.apiCenterSdkService
        .getClient()
        .paymentGetCheckoutStatus(registration.checkout_id);
      if (checkoutSession.status === 'paid') break;
      if (i < MAX_ATTEMPTS - 1) await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }

    if (checkoutSession!.status !== 'paid') {
      const isDev = this.config.get<string>('NODE_ENV') !== 'production';
      if (isDev) {
        this.logger.warn(
          `DEV MODE: Checkout status "${checkoutSession!.status}" — trusting PayMongo successUrl redirect. Proceeding as paid.`,
        );
      } else {
        throw new BadRequestException(
          `Checkout not paid yet. Current status: ${checkoutSession!.status}`,
        );
      }
    }

    const transactionId =
      checkoutSession!.referenceId ??
      checkoutSession!.checkoutId ??
      registration.checkout_id;

    const { error: paymentErr } = await supabase
      .from('company_registrations')
      .update({
        payment_status: 'Paid',
        payment_date: new Date().toISOString(),
        transaction_id: transactionId,
        subscription_status: 'Pending',
      })
      .eq('registration_id', dto.registration_id);

    if (paymentErr) throw new InternalServerErrorException(paymentErr.message);

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

    return {
      message: 'Payment confirmed. Awaiting super admin provisioning.',
      registration_id: dto.registration_id,
    };
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
