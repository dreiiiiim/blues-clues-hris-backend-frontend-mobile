import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class SuperAdminDashboardService {
  constructor(private readonly supabase: SupabaseService) {}

  async getStats() {
    const db = this.supabase.getClient();

    const [total, active, pending, suspended, expired] = await Promise.all([
      db.from('company').select('company_id', { count: 'exact', head: true }),
      db.from('company_registrations').select('registration_id', { count: 'exact', head: true })
        .ilike('subscription_status', 'active'),
      db.from('company_registrations').select('registration_id', { count: 'exact', head: true })
        .ilike('payment_status', 'pending'),
      db.from('company_registrations').select('registration_id', { count: 'exact', head: true })
        .ilike('subscription_status', 'suspended'),
      db.from('company_registrations').select('registration_id', { count: 'exact', head: true })
        .ilike('subscription_status', 'expired'),
    ]);

    return {
      total_companies: total.count ?? 0,
      active_subscriptions: active.count ?? 0,
      pending_approvals: pending.count ?? 0,
      suspended_count: suspended.count ?? 0,
      expired_count: expired.count ?? 0,
      monthly_revenue: null,
    };
  }

  async getPendingApprovals() {
    const db = this.supabase.getClient();
    const { data, error } = await db
      .from('company_registrations')
      .select('registration_id, company_id, company_name, email, industry, subscription_plan, billing_cycle, registered_date')
      .ilike('payment_status', 'pending')
      .order('registered_date', { ascending: true });

    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }
}
