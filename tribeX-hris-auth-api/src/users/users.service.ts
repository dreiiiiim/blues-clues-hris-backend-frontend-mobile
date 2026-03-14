import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto } from './dto/create-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as crypto from 'crypto';

type UserListRow = {
  user_id: string;
  employee_id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role_id: string | null;
  department_id: string | null;
  start_date: string | null;
  account_status: string | null;
};

@Injectable()
export class UsersService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  // All queries filter by company_id. company_id comes from req.user.

  async getCompanies(companyId?: string) {
    const supabase = this.supabaseService.getClient();
    const baseQuery = supabase
      .from('company')
      .select('company_id, company_name')
      .order('company_name');
    const { data, error } = companyId
      ? await baseQuery.eq('company_id', companyId)
      : await baseQuery;
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async getCompanyInfo(companyId: string) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('company')
      .select('company_id, company_name, slug')
      .eq('company_id', companyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundException('Company not found');
    return data;
  }

  private async getNextEmployeeNumber(companyId: string): Promise<number> {
    const supabase = this.supabaseService.getClient();

    // Optimistic concurrency control on last_number to avoid duplicates.
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: seqRow, error: seqReadError } = await supabase
        .from('employee_id_sequence')
        .select('last_number')
        .eq('company_id', companyId)
        .maybeSingle();

      if (seqReadError)
        throw new InternalServerErrorException(seqReadError.message);

      if (!seqRow) {
        const { error: seedError } = await supabase
          .from('employee_id_sequence')
          .insert({ company_id: companyId, last_number: 0 });
        if (seedError && (seedError as any).code !== '23505') {
          throw new InternalServerErrorException(seedError.message);
        }
        continue;
      }

      const current = Number(seqRow.last_number ?? 0);
      const next = current + 1;

      const { data: updatedRow, error: seqUpdateError } = await supabase
        .from('employee_id_sequence')
        .update({ last_number: next })
        .eq('company_id', companyId)
        .eq('last_number', current)
        .select('last_number')
        .maybeSingle();

      if (seqUpdateError)
        throw new InternalServerErrorException(seqUpdateError.message);
      if (updatedRow) return Number(updatedRow.last_number);
    }

    throw new InternalServerErrorException(
      'Could not generate employee number due to concurrent updates. Please try again.',
    );
  }

  private async getInviteExpiryMap(userIds: string[]) {
    if (userIds.length === 0) return {} as Record<string, string | null>;

    const { data, error } = await this.supabaseService
      .getClient()
      .from('user_invites')
      .select('user_id, expires_at')
      .is('used_at', null)
      .in('user_id', userIds)
      .order('expires_at', { ascending: false });

    if (error) throw new Error(error.message);

    const map: Record<string, string | null> = {};
    for (const row of data ?? []) {
      if (!map[row.user_id]) map[row.user_id] = row.expires_at;
    }
    return map;
  }

  private async getLastLoginMap(userIds: string[]) {
    if (userIds.length === 0) return {} as Record<string, string | null>;

    const { data, error } = await this.supabaseService
      .getClient()
      .from('login_history')
      .select('user_id, li_timestamp')
      .eq('status', 'SUCCESS')
      .in('user_id', userIds)
      .order('li_timestamp', { ascending: false });

    if (error) throw new Error(error.message);

    const lastLoginByUser: Record<string, string | null> = {};
    for (const row of data ?? []) {
      if (!lastLoginByUser[row.user_id]) {
        lastLoginByUser[row.user_id] = row.li_timestamp;
      }
    }

    return lastLoginByUser;
  }

  async getRoles(companyId: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('role')
      .select('role_id, role_name')
      .eq('company_id', companyId)
      .order('role_name');

    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async createDepartment(name: string, companyId: string) {
    const supabase = this.supabaseService.getClient();
    const year = new Date().getFullYear();

    for (let attempt = 0; attempt < 5; attempt++) {
      const rand = String(Math.floor(Math.random() * 9000) + 1000);
      const department_id = `DPT-${year}-${rand}`;

      const { data, error } = await supabase
        .from('department')
        .insert({ department_id, department_name: name, company_id: companyId })
        .select('department_id, department_name')
        .single();

      if (!error) return data;
      if ((error as any).code !== '23505') throw new Error(error.message);
      // 23505 = unique violation on department_id, retry with new random
    }

    throw new InternalServerErrorException(
      'Could not generate a unique department ID. Please try again.',
    );
  }

  async getDepartments(companyId: string) {
    if (!companyId) return [];
    const { data, error } = await this.supabaseService
      .getClient()
      .from('department')
      .select('department_id, department_name')
      .eq('company_id', companyId)
      .order('department_name');
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async findAll(companyId: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('user_profile')
      .select(
        'user_id, employee_id, username, first_name, last_name, email, role_id, department_id, start_date, account_status',
      )
      .eq('company_id', companyId)
      .order('first_name');

    if (error) throw new Error(error.message);

    const users = (data ?? []) as UserListRow[];
    const userIds = users.map((user) => user.user_id);

    const [lastLoginByUser, inviteExpiryByUser] = await Promise.all([
      this.getLastLoginMap(userIds),
      this.getInviteExpiryMap(userIds),
    ]);

    return users.map((user) => ({
      ...user,
      last_login: lastLoginByUser[user.user_id] ?? null,
      invite_expires_at: inviteExpiryByUser[user.user_id] ?? null,
    }));
  }

  async findOne(id: string, companyId: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('user_profile')
      .select(
        'user_id, employee_id, username, first_name, last_name, email, role_id, department_id, start_date, account_status',
      )
      .eq('user_id', id)
      .eq('company_id', companyId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return data;

    const lastLoginByUser = await this.getLastLoginMap([id]);
    return {
      ...data,
      last_login: lastLoginByUser[id] ?? null,
    };
  }

  async stats(companyId: string) {
    const { count, error } = await this.supabaseService
      .getClient()
      .from('user_profile')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId);

    if (error) throw new Error(error.message);
    return { total: count ?? 0 };
  }

  async create(
    dto: CreateUserDto,
    companyId: string,
    adminUserId: string,
  ) {
    const supabase = this.supabaseService.getClient();
    const user_id = crypto.randomUUID();
    const email = dto.email.trim();

    const nextNumber = await this.getNextEmployeeNumber(companyId);
    const employee_id = `empno-${String(nextNumber).padStart(5, '0')}`;

    const { data: existingUsername } = await supabase
      .from('user_profile')
      .select('user_id')
      .eq('username', dto.username)
      .maybeSingle();

    if (existingUsername) {
      throw new ConflictException(
        `Username "${dto.username}" is already taken`,
      );
    }

    const { data: roleRow, error: roleError } = await supabase
      .from('role')
      .select('role_id, company_id')
      .eq('role_id', dto.role_id)
      .maybeSingle();
    if (roleError) throw new InternalServerErrorException(roleError.message);
    if (!roleRow)
      throw new BadRequestException('Selected role does not exist.');
    if (roleRow.company_id && roleRow.company_id !== companyId) {
      throw new BadRequestException(
        'Selected role belongs to a different company.',
      );
    }

    if (dto.department_id) {
      const { data: departmentRow, error: departmentError } = await supabase
        .from('department')
        .select('department_id, company_id')
        .eq('department_id', dto.department_id)
        .maybeSingle();
      if (departmentError)
        throw new InternalServerErrorException(departmentError.message);
      if (!departmentRow)
        throw new BadRequestException('Selected department does not exist.');

      if (departmentRow.company_id && departmentRow.company_id !== companyId) {
        throw new BadRequestException(
          'Selected department belongs to a different company.',
        );
      }
    }

    const { error: insertError } = await supabase.from('user_profile').insert({
      user_id,
      email,
      first_name: dto.first_name,
      last_name: dto.last_name,
      role_id: dto.role_id,
      company_id: companyId,
      employee_id,
      username: dto.username,
      account_status: 'Pending',
      ...(dto.department_id ? { department_id: dto.department_id } : {}),
      ...(dto.start_date ? { start_date: dto.start_date } : {}),
    });

    if (insertError) {
      const dbCode = (insertError as any)?.code as string | undefined;
      if (dbCode === '23505') {
        throw new ConflictException(
          'A user with the same username or email already exists.',
        );
      }
      if (dbCode === '23503') {
        throw new BadRequestException('Invalid role or department selected.');
      }
      throw new BadRequestException(insertError.message);
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    const { error: inviteError } = await supabase.from('user_invites').insert({
      invite_id: crypto.randomUUID(),
      user_id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    if (inviteError)
      throw new InternalServerErrorException(inviteError.message);

    const appUrl =
      this.config.get<string>('APP_URL') ?? 'http://localhost:3000';
    const inviteLink = `${appUrl}/set-password?token=${rawToken}`;

    try {
      await this.mailService.sendInvite(email, inviteLink);
    } catch (emailError) {
      console.log('[create] email error:', emailError?.message ?? emailError);
      console.log('==========================================');
      console.log('DEV MODE - invite link (copy and open in browser):');
      console.log(`Invite recipient: ${email}`);
      console.log(inviteLink);
      console.log('==========================================');
    }

    await this.auditService.log(
      `User created: ${email}`,
      adminUserId,
      user_id,
    );

    return {
      user_id,
      employee_id,
      email,
      username: dto.username,
      invite_expires_at: expiresAt,
    };
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    companyId: string,
    adminUserId: string,
  ) {
    const supabase = this.supabaseService.getClient();

    const { data: user, error: findError } = await supabase
      .from('user_profile')
      .select(
        'user_id, email, first_name, last_name, role_id, department_id, start_date',
      )
      .eq('user_id', id)
      .eq('company_id', companyId)
      .maybeSingle();

    if (findError) throw new BadRequestException(findError.message);
    if (!user) throw new NotFoundException('User not found in your company');

    const updates: Record<string, any> = {};
    if (dto.first_name !== undefined) updates.first_name = dto.first_name;
    if (dto.last_name !== undefined) updates.last_name = dto.last_name;
    if (dto.role_id !== undefined) updates.role_id = dto.role_id;
    if (dto.department_id !== undefined)
      updates.department_id = dto.department_id;
    if (dto.start_date !== undefined) updates.start_date = dto.start_date;

    if (Object.keys(updates).length === 0) {
      return { message: 'No fields to update' };
    }

    const { error: updateError } = await supabase
      .from('user_profile')
      .update(updates)
      .eq('user_id', id)
      .eq('company_id', companyId);

    if (updateError) throw new BadRequestException(updateError.message);

    const changes = Object.keys(updates)
      .map((field) => {
        const before = user[field] ?? null;
        const after = updates[field] ?? null;
        return `${field}: "${before}" -> "${after}"`;
      })
      .join(', ');

    await this.auditService.log(
      `User profile updated: ${user.email} - ${changes}`,
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

    if (findError) throw new BadRequestException(findError.message);
    if (!user) throw new NotFoundException('User not found in your company');

    const { error: deactivateError } = await supabase
      .from('user_profile')
      .update({ account_status: 'Inactive' })
      .eq('user_id', id)
      .eq('company_id', companyId);

    if (deactivateError) throw new BadRequestException(deactivateError.message);

    // Revoke all active refresh sessions so the user is immediately logged out
    await supabase
      .from('refresh_session')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', id)
      .is('revoked_at', null);

    await this.auditService.log(
      `User deactivated: ${user.email}`,
      adminUserId,
      id,
    );

    return { message: 'User deactivated successfully' };
  }

  async resendInvite(id: string, companyId: string, adminUserId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: user, error: findError } = await supabase
      .from('user_profile')
      .select('user_id, email, account_status, password_hash')
      .eq('user_id', id)
      .eq('company_id', companyId)
      .maybeSingle();

    if (findError) throw new BadRequestException(findError.message);
    if (!user) throw new NotFoundException('User not found in your company');
    if (user.account_status === 'Inactive')
      throw new BadRequestException('Cannot resend invite to a deactivated account.');
    if (user.password_hash)
      throw new BadRequestException('User has already activated their account.');

    // Revoke all existing unused invites
    await supabase
      .from('user_invites')
      .delete()
      .eq('user_id', id)
      .is('used_at', null);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    const { error: inviteError } = await supabase.from('user_invites').insert({
      invite_id: crypto.randomUUID(),
      user_id: id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    if (inviteError) throw new InternalServerErrorException(inviteError.message);

    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:3000';
    const inviteLink = `${appUrl}/set-password?token=${rawToken}`;

    try {
      await this.mailService.sendInvite(user.email, inviteLink);
    } catch (emailError) {
      console.log('[resendInvite] email error:', emailError?.message ?? emailError);
      console.log('==========================================');
      console.log('DEV MODE - invite link (copy and open in browser):');
      console.log(`Invite recipient: ${user.email}`);
      console.log(inviteLink);
      console.log('==========================================');
    }

    await this.auditService.log(
      `Invite resent to: ${user.email}`,
      adminUserId,
      id,
    );

    return { message: `Invite resent to ${user.email}.`, invite_expires_at: expiresAt };
  }

  async reactivate(id: string, companyId: string, adminUserId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: user, error: findError } = await supabase
      .from('user_profile')
      .select('user_id, email, account_status, password_hash')
      .eq('user_id', id)
      .eq('company_id', companyId)
      .maybeSingle();

    if (findError) throw new BadRequestException(findError.message);
    if (!user) throw new NotFoundException('User not found in your company');
    if (user.account_status !== 'Inactive')
      throw new BadRequestException('User is not inactive');

    const nextStatus = user.password_hash ? 'Active' : 'Pending';

    const { error: updateError } = await supabase
      .from('user_profile')
      .update({ account_status: nextStatus })
      .eq('user_id', id)
      .eq('company_id', companyId);

    if (updateError) throw new BadRequestException(updateError.message);

    await this.auditService.log(
      `User reactivated: ${user.email} -> ${nextStatus}`,
      adminUserId,
      id,
    );

    return { message: `User reactivated successfully as ${nextStatus}` };
  }
}
