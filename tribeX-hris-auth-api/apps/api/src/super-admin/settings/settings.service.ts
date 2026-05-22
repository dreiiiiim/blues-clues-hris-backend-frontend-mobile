import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '@app/supabase';

@Injectable()
export class SuperAdminSettingsService {
  constructor(private readonly supabase: SupabaseService) {}

  async getProfile(adminId: string) {
    const db = this.supabase.getClient();
    const { data, error } = await db
      .from('super_admin_users')
      .select('id, email, name, created_at')
      .eq('id', adminId)
      .maybeSingle();
    if (error || !data) throw new NotFoundException('Admin not found');
    return data;
  }

  async updateProfile(adminId: string, name: string) {
    const db = this.supabase.getClient();
    const { error } = await db.from('super_admin_users').update({ name }).eq('id', adminId);
    if (error) throw new BadRequestException(error.message);
    return { success: true };
  }

  async changePassword(adminId: string, adminEmail: string, currentPassword: string, newPassword: string) {
    const db = this.supabase.getClient();

    const { error: verifyError } = await db.auth.signInWithPassword({ email: adminEmail, password: currentPassword });
    if (verifyError) throw new BadRequestException('Current password is incorrect');

    const { error } = await db.auth.admin.updateUserById(adminId, { password: newPassword });
    if (error) throw new BadRequestException(error.message);

    await db.from('admin_audit_logs').insert({
      action: 'PASSWORD_CHANGE: super admin changed their password',
      performed_by: adminId,
      severity: 'INFO',
    });

    return { success: true };
  }

  async getNotifications(adminId: string) {
    const db = this.supabase.getClient();
    const { data } = await db.from('super_admin_settings').select('*').eq('admin_id', adminId).maybeSingle();
    return data ?? {
      admin_id: adminId,
      notify_new_signup: true, notify_payment: true,
      notify_renewal_due: true, notify_expiry: true,
    };
  }

  async updateNotifications(adminId: string, prefs: {
    notify_new_signup: boolean; notify_payment: boolean;
    notify_renewal_due: boolean; notify_expiry: boolean;
  }) {
    const db = this.supabase.getClient();
    const { error } = await db.from('super_admin_settings').upsert(
      { admin_id: adminId, ...prefs, updated_at: new Date().toISOString() },
      { onConflict: 'admin_id' },
    );
    if (error) throw new BadRequestException(error.message);
    return { success: true };
  }

  async getAuditLog() {
    const db = this.supabase.getClient();
    const { data, error } = await db
      .from('admin_audit_logs')
      .select('id, action, performed_by, company_id, severity, created_at')
      .order('created_at', { ascending: false })
      .limit(25);
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  getSystemSettings() {
    return { payment_gateway: null, credential_provisioning: null };
  }
}
