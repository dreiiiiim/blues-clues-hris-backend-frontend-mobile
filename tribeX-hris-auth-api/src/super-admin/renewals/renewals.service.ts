import { Injectable, NotFoundException, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { MailService } from '../../mail/mail.service';

type RenewalStatus = 'Upcoming' | 'Due Soon' | 'Expired';

@Injectable()
export class SuperAdminRenewalsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly mail: MailService,
  ) {}

  private computeEndDate(paymentDate: string, billingCycle: string): Date {
    const d = new Date(paymentDate);
    if (billingCycle === 'annual') d.setFullYear(d.getFullYear() + 1);
    else d.setMonth(d.getMonth() + 1);
    return d;
  }

  private getRenewalStatus(endDate: Date): { status: RenewalStatus; daysRemaining: number } {
    const now = new Date();
    const diff = Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    let status: RenewalStatus;
    if (diff < 0) status = 'Expired';
    else if (diff <= 30) status = 'Due Soon';
    else status = 'Upcoming';
    return { status, daysRemaining: diff };
  }

  async list(statusFilter?: string) {
    const db = this.supabase.getClient();
    const { data, error } = await db
      .from('company_registrations')
      .select('registration_id, company_id, company_name, subscription_plan, billing_cycle, payment_date, email, subscription_status')
      .or('subscription_status.ilike.active,subscription_status.ilike.expired');

    if (error) throw new BadRequestException(error.message);

    const enriched = (data ?? [])
      .map(r => {
        if (!r.payment_date) return null;
        const endDate = this.computeEndDate(r.payment_date, r.billing_cycle);
        const { status, daysRemaining } = this.getRenewalStatus(endDate);
        return { ...r, end_date: endDate.toISOString(), days_remaining: daysRemaining, renewal_status: status };
      })
      .filter(Boolean);

    if (statusFilter) {
      const filterMap: Record<string, RenewalStatus> = {
        upcoming: 'Upcoming', due_soon: 'Due Soon', expired: 'Expired',
      };
      const target = filterMap[statusFilter.toLowerCase()];
      return enriched.filter(r => r!.renewal_status === target);
    }

    return enriched;
  }

  async sendReminder(registrationId: string, performedBy: string) {
    const db = this.supabase.getClient();

    const { data: reg } = await db
      .from('company_registrations')
      .select('registration_id, company_name, subscription_plan, billing_cycle, payment_date, email')
      .eq('registration_id', registrationId)
      .maybeSingle();
    if (!reg) throw new NotFoundException('Registration not found');

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await db
      .from('renewal_reminders')
      .select('id')
      .eq('registration_id', registrationId)
      .gte('sent_at', since)
      .limit(1);

    if (recent && recent.length > 0) {
      throw new HttpException('Reminder already sent within the last 24 hours', HttpStatus.TOO_MANY_REQUESTS);
    }

    const endDate = this.computeEndDate(reg.payment_date, reg.billing_cycle);
    const { daysRemaining } = this.getRenewalStatus(endDate);

    await this.mail.sendRenewalReminder(reg.email, reg.company_name, daysRemaining, reg.subscription_plan);

    await db.from('renewal_reminders').insert({ registration_id: registrationId, sent_by: performedBy });
    await db.from('admin_audit_logs').insert({
      action: `RENEWAL_REMINDER: sent to ${reg.email} for ${reg.company_name} (${daysRemaining} days)`,
      performed_by: performedBy,
      severity: 'INFO',
    });

    return { success: true, days_remaining: daysRemaining };
  }

  async markRenewed(registrationId: string, billingCycle: 'monthly' | 'annual', performedBy: string) {
    const db = this.supabase.getClient();
    const now = new Date().toISOString();

    const { error } = await db
      .from('company_registrations')
      .update({ subscription_status: 'Active', payment_status: 'Paid', payment_date: now, billing_cycle: billingCycle })
      .eq('registration_id', registrationId);

    if (error) throw new BadRequestException(error.message);

    await db.from('admin_audit_logs').insert({
      action: `MARK_RENEWED: ${registrationId} — billing_cycle=${billingCycle}, payment_date=${now}`,
      performed_by: performedBy,
      severity: 'INFO',
    });

    return { success: true };
  }

  async suspend(registrationId: string, performedBy: string) {
    const db = this.supabase.getClient();
    const { data: reg } = await db
      .from('company_registrations')
      .select('email, company_name')
      .eq('registration_id', registrationId)
      .maybeSingle();
    if (!reg) throw new NotFoundException('Registration not found');

    const { error } = await db
      .from('company_registrations')
      .update({ subscription_status: 'Suspended' })
      .eq('registration_id', registrationId);
    if (error) throw new BadRequestException(error.message);

    await this.mail.sendSuspensionNotice(reg.email, reg.company_name);

    await db.from('admin_audit_logs').insert({
      action: `SUSPEND_FROM_RENEWALS: ${registrationId} (${reg.company_name})`,
      performed_by: performedBy,
      severity: 'WARNING',
    });

    return { success: true };
  }
}
