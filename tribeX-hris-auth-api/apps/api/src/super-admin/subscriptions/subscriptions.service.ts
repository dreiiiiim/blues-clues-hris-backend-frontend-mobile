import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '@app/supabase';

@Injectable()
export class SuperAdminSubscriptionsService {
  constructor(private readonly supabase: SupabaseService) {}

  private computeEndDate(paymentDate: string, billingCycle: string): string {
    if (!paymentDate) return '';
    const d = new Date(paymentDate);
    if (billingCycle === 'annual') d.setFullYear(d.getFullYear() + 1);
    else d.setMonth(d.getMonth() + 1);
    return d.toISOString();
  }

  async list(query: { status?: string; billing_cycle?: string; page?: number; limit?: number }) {
    const db = this.supabase.getClient();
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    let q = db
      .from('company_registrations')
      .select(
        'registration_id, company_id, company_name, subscription_plan, billing_cycle, subscription_status, payment_status, payment_date, transaction_id',
        { count: 'exact' },
      )
      .range(offset, offset + limit - 1)
      .order('payment_date', { ascending: false });

    if (query.status) q = q.ilike('subscription_status', query.status);
    if (query.billing_cycle) q = q.eq('billing_cycle', query.billing_cycle);

    const { data, error, count } = await q;
    if (error) throw new BadRequestException(error.message);

    const enriched = (data ?? []).map(r => ({
      ...r,
      start_date: r.payment_date,
      end_date: this.computeEndDate(r.payment_date, r.billing_cycle),
    }));

    return { data: enriched, total: count, page, limit };
  }

  async detail(registrationId: string) {
    const db = this.supabase.getClient();
    const { data, error } = await db
      .from('company_registrations')
      .select('*')
      .eq('registration_id', registrationId)
      .maybeSingle();
    if (error || !data) throw new NotFoundException('Subscription not found');
    return {
      ...data,
      start_date: data.payment_date,
      end_date: this.computeEndDate(data.payment_date, data.billing_cycle),
    };
  }

  async updateStatus(registrationId: string, subscriptionStatus: string, performedBy: string) {
    const db = this.supabase.getClient();
    const { error } = await db
      .from('company_registrations')
      .update({ subscription_status: subscriptionStatus })
      .eq('registration_id', registrationId);
    if (error) throw new BadRequestException(error.message);

    await db.from('admin_audit_logs').insert({
      action: `SUBSCRIPTION_STATUS_UPDATE: ${registrationId} → ${subscriptionStatus}`,
      performed_by: performedBy,
      severity: 'INFO',
    });
    return { success: true };
  }

  async paymentHistory(registrationId: string) {
    const db = this.supabase.getClient();
    const { data, error } = await db
      .from('company_registrations')
      .select('registration_id, payment_status, payment_date, transaction_id, billing_cycle, subscription_plan')
      .eq('registration_id', registrationId)
      .maybeSingle();
    if (error || !data) throw new NotFoundException('Subscription not found');
    return { records: [data], total: 1 };
  }
}
