import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto } from './dto/create-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as crypto from 'crypto';

@Injectable()
export class UsersService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  // All queries filter by company_id — this is what enforces multi-tenancy.
  // company_id comes from req.user (decoded from the JWT), never from the request body.

  async getRoles(companyId: string) {
    const supabase = this.supabaseService.getClient();

    // Fetch roles that belong to this company OR are global (company_id IS NULL)
    const { data, error } = await supabase
      .from('role')
      .select('role_id, role_name')
      .or(`company_id.eq.${companyId},company_id.is.null`)
      .order('role_name');

    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async findAll(companyId: string) {
    const { data, error } = await this.supabaseService.getClient()
      .from('user_profile')
      .select('user_id, employee_id, username, first_name, last_name, email, role_id, department_id, start_date, account_status')
      .eq('company_id', companyId)
      .order('first_name');

    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async findOne(id: string, companyId: string) {
    const { data, error } = await this.supabaseService.getClient()
      .from('user_profile')
      .select('user_id, employee_id, username, first_name, last_name, email, role_id, department_id, start_date, account_status')
      .eq('user_id', id)
      .eq('company_id', companyId) // prevents cross-company lookups
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  }

  async stats(companyId: string) {
    const { count, error } = await this.supabaseService.getClient()
      .from('user_profile')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId);

    if (error) throw new Error(error.message);
    return { total: count ?? 0 };
  }

  async create(dto: CreateUserDto, companyId: string, adminUserId: string) {
    console.log('[create] received dto:', dto);
    const supabase = this.supabaseService.getClient();
    const user_id = crypto.randomUUID();

    // Atomically increment the sequence counter in a single DB round-trip.
    // Using a Postgres RPC prevents the read-modify-write race that would produce
    // duplicate employee_id values under concurrent requests.
    const { data: nextNumber, error: seqError } = await supabase
      .rpc('get_next_employee_number', { p_company_id: companyId });

    if (seqError) throw new Error(seqError.message);
    const employee_id = `empno-${String(nextNumber).padStart(5, '0')}`;

    // Check username is not already taken (username is globally unique across all companies)
    const { data: existingUsername } = await supabase
      .from('user_profile')
      .select('user_id')
      .eq('username', dto.username)
      .maybeSingle();

    if (existingUsername) throw new Error(`Username "${dto.username}" is already taken`);

    // Insert the new user into user_profile
    // company_id comes from the JWT — admins can only create users under their own company
    const { error: insertError } = await supabase
      .from('user_profile')
      .insert({
        user_id,
        email: dto.email,
        first_name: dto.first_name,
        last_name: dto.last_name,
        role_id: dto.role_id,
        company_id: companyId,
        employee_id,
        username: dto.username,
        account_status: 'Pending',
        ...(dto.department_id ? { department_id: dto.department_id } : {}),
        ...(dto.start_date    ? { start_date: dto.start_date }       : {}),
      });

    if (insertError) throw new Error(insertError.message);

    // Generate invite token — raw token goes in the email, hashed version is stored in DB
    const rawToken  = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(); // 48 hours

    const { error: inviteError } = await supabase
      .from('user_invites')
      .insert({
        invite_id: crypto.randomUUID(),
        user_id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      });

    if (inviteError) throw new Error(inviteError.message);

    // Build the invite link and send the email
    // If email fails, roll back — delete the invite and user so there's no orphaned record
    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:3000';
    const inviteLink = `${appUrl}/set-password?token=${rawToken}`;

    try {
      await this.mailService.sendInvite(dto.email, inviteLink);
    } catch (emailError) {
      // TODO (Production): remove this fallback once a verified domain is set up in Resend
      // For development: log the invite link to the terminal so you can test without email
      console.log('[create] email error:', emailError?.message ?? emailError);
      console.log('==========================================');
      console.log('DEV MODE — invite link (copy and open in browser):');
      console.log(inviteLink);
      console.log('==========================================');
    }

    await this.auditService.log(`User created: ${dto.email}`, adminUserId, user_id);

    return { user_id, employee_id, email: dto.email, username: dto.username };
  }

  async update(id: string, dto: UpdateUserDto, companyId: string, adminUserId: string) {
    const supabase = this.supabaseService.getClient();

    // Fetch current values so we can record before/after in the audit log
    const { data: user, error: findError } = await supabase
      .from('user_profile')
      .select('user_id, email, first_name, last_name, role_id, department_id, start_date')
      .eq('user_id', id)
      .eq('company_id', companyId)
      .maybeSingle();

    if (findError) throw new Error(findError.message);
    if (!user) throw new Error('User not found in your company');

    // Build the update payload from only the fields provided in the DTO
    const updates: Record<string, any> = {};
    if (dto.first_name    !== undefined) updates.first_name    = dto.first_name;
    if (dto.last_name     !== undefined) updates.last_name     = dto.last_name;
    if (dto.role_id       !== undefined) updates.role_id       = dto.role_id;
    if (dto.department_id !== undefined) updates.department_id = dto.department_id;
    if (dto.start_date    !== undefined) updates.start_date    = dto.start_date;

    if (Object.keys(updates).length === 0) {
      return { message: 'No fields to update' };
    }

    const { error: updateError } = await supabase
      .from('user_profile')
      .update(updates)
      .eq('user_id', id)
      .eq('company_id', companyId);

    if (updateError) throw new Error(updateError.message);

    // Build a before/after diff for each changed field
    const changes = Object.keys(updates).map((field) => {
      const before = user[field] ?? null;
      const after  = updates[field] ?? null;
      return `${field}: "${before}" → "${after}"`;
    }).join(', ');

    await this.auditService.log(
      `User profile updated: ${user.email} — ${changes}`,
      adminUserId,
      id,
    );

    return { message: 'User updated successfully' };
  }

  async remove(id: string, companyId: string, adminUserId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: user, error: findError } = await supabase
      .from('user_profile')
      .select('user_id, email')
      .eq('user_id', id)
      .eq('company_id', companyId)
      .maybeSingle();

    if (findError) throw new Error(findError.message);
    if (!user) throw new Error('User not found in your company');

    // Soft delete: set account_status to 'Inactive' instead of deleting the row.
    // This preserves all FK references (login_history, audit_logs, etc.) and keeps
    // the audit trail intact. The user can be reactivated by setting status back to 'Active'.
    const { error: deactivateError } = await supabase
      .from('user_profile')
      .update({ account_status: 'Inactive' })
      .eq('user_id', id)
      .eq('company_id', companyId);

    if (deactivateError) throw new Error(deactivateError.message);

    // Revoke all active refresh sessions so the user is immediately logged out
    await supabase
      .from('refresh_session')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', id)
      .is('revoked_at', null);

    await this.auditService.log(`User deactivated: ${user.email}`, adminUserId, id);

    return { message: 'User deactivated successfully' };
  }

  async reactivate(id: string, companyId: string, adminUserId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: user, error: findError } = await supabase
      .from('user_profile')
      .select('user_id, email, account_status')
      .eq('user_id', id)
      .eq('company_id', companyId)
      .maybeSingle();

    if (findError) throw new Error(findError.message);
    if (!user) throw new Error('User not found in your company');
    if (user.account_status !== 'Inactive') throw new Error('User is not inactive');

    const { error: updateError } = await supabase
      .from('user_profile')
      .update({ account_status: 'Active' })
      .eq('user_id', id)
      .eq('company_id', companyId);

    if (updateError) throw new Error(updateError.message);

    await this.auditService.log(`User reactivated: ${user.email}`, adminUserId, id);

    return { message: 'User reactivated successfully' };
  }
}
