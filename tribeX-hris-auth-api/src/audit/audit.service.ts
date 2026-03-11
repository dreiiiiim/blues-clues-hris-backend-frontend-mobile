import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AuditService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async log(action: string, performedBy: string, targetUserId?: string) {
    const { error } = await this.supabaseService.getClient()
      .from('admin_audit_logs')
      .insert({
        action,
        performed_by: performedBy,
        target_user_id: targetUserId ?? null,
      });

    // Audit logging is fire-and-forget — a failure here should never break the main operation.
    // Log to console so it's visible in server logs without crashing the request.
    if (error) {
      console.error('[AuditService] Failed to write audit log:', error.message);
    }
  }
}
