import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AuditService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async log(action: string, performedBy: string, targetUserId?: string) {
    const { error } = await this.supabaseService
      .getClient()
      .from('admin_audit_logs')
      .insert({
        action,
        performed_by: performedBy,
        target_user_id: targetUserId ?? null,
      });

    // Audit logging is fire-and-forget — a failure here should never break the main operation.
    if (error) {
      console.error('[AuditService] Failed to write audit log:', error.message);
    }
  }

  async getLogs(limit = 50, offset = 0) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('admin_audit_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async getLogsCount() {
    const { count, error } = await this.supabaseService
      .getClient()
      .from('admin_audit_logs')
      .select('*', { count: 'exact', head: true });

    if (error) throw new InternalServerErrorException(error.message);
    return { count: count ?? 0 };
  }
}
