import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { FileLeaveRequestDto, RETRO_ELIGIBLE_LEAVE_TYPES } from './dto/file-leave-request.dto';
import { ReviewLeaveRequestDto } from './dto/review-leave-request.dto';
import { MailService } from '../mail/mail.service';
import { LeaveBalancesService } from '../leave-balances/leave-balances.service';

const DEFAULT_LEAVE_ALLOCATIONS: Record<string, number> = {
  'Vacation Leave': 15,
  'Sick Leave': 10,
  'Emergency Leave': 3,
  'Personal Leave': 2,
  'Maternity Leave': 0,
  'Paternity Leave': 0,
};

@Injectable()
export class LeaveService {
  private readonly logger = new Logger(LeaveService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly mailService: MailService,
    private readonly leaveBalancesService: LeaveBalancesService,
  ) {}

  // ──────────────────────────────────────────────────────────────
  // EMPLOYEE: Get own leave balances
  // GET /leave/balances
  // Returns shape expected by frontend payrollApi:
  //   [{ type, remaining, total }]
  // ──────────────────────────────────────────────────────────────
  async getMyLeaveBalances(userId: string, companyId: string) {
    const my = await this.leaveBalancesService.getEmployeeBalances(userId, companyId);
    type EmployeeBalanceRow = {
      leave_category: string;
      entitled_days: number;
      used_days: number;
    };
    const categories = ((my as { categories?: EmployeeBalanceRow[] } | null)?.categories ?? []);
    const byCategory = new Map<string, EmployeeBalanceRow>(
      categories.map((row) => [row.leave_category, row] as [string, EmployeeBalanceRow]),
    );

    return [
      'Vacation Leave',
      'Sick Leave',
      'Emergency Leave',
      'Personal Leave',
      'Maternity Leave',
      'Paternity Leave',
    ].map((type) => {
      const row = byCategory.get(type);
      const total = Number(row?.entitled_days ?? 0);
      const used = Number(row?.used_days ?? 0);
      return {
        type: type.replace(' Leave', ''),
        remaining: Math.max(0, total - used),
        total,
      };
    });
  }

  // ──────────────────────────────────────────────────────────────
  // EMPLOYEE: File a leave request
  // POST /leave/requests
  // ──────────────────────────────────────────────────────────────
  async fileLeaveRequest(
    userId: string,
    companyId: string,
    dto: FileLeaveRequestDto,
  ) {
    const supabase = this.supabaseService.getClient();

    const start = new Date(dto.start_date);
    const end = new Date(dto.end_date);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD.');
    }
    if (end < start) {
      throw new BadRequestException('end_date must be on or after start_date.');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isRetro = dto.is_retro === true;

    // Retro-filing: only Sick Leave and Emergency Leave are backward-compatible
    if (isRetro) {
      if (!RETRO_ELIGIBLE_LEAVE_TYPES.includes(dto.leave_type)) {
        throw new BadRequestException(
          `Retro-filing is only allowed for: ${RETRO_ELIGIBLE_LEAVE_TYPES.join(', ')}. Use a standard request for ${dto.leave_type}.`,
        );
      }
      if (!dto.retro_reason) {
        throw new BadRequestException('retro_reason is required when filing a retro leave request.');
      }
      if (start >= today) {
        throw new BadRequestException('Retro leave requests must have a start_date in the past.');
      }
    } else {
      // Standard filing: reject past-date requests (except same-day)
      if (start < today && dto.leave_type === 'Sick Leave') {
        throw new BadRequestException(
          'Sick leave for past dates must use retro-filing (set is_retro: true and provide retro_reason).',
        );
      }
    }

    const msPerDay = 1000 * 60 * 60 * 24;
    const totalDays =
      Math.round((end.getTime() - start.getTime()) / msPerDay) + 1;

    // Overlap check: reject if dates collide with any Pending or Approved request
    const { data: overlapping } = await supabase
      .from('time_leave_requests')
      .select('request_id, leave_type, start_date, end_date, status')
      .eq('user_id', userId)
      .in('status', ['Pending', 'Approved'])
      .lte('start_date', dto.end_date)
      .gte('end_date', dto.start_date);

    if (overlapping && overlapping.length > 0) {
      const c = overlapping[0];
      const label = c.status === 'Approved' ? 'approved' : 'pending';
      throw new BadRequestException(
        `You already have a ${label} ${c.leave_type} request from ${c.start_date} to ${c.end_date}. Please revoke or wait for it to be resolved before filing another.`,
      );
    }

    // Check against effective policy balance (company/department/individual) + usage
    const effective = (await this.leaveBalancesService.getEmployeeBalances(
      userId,
      companyId,
    )) as {
      categories?: Array<{
        leave_category: string;
        entitled_days: number;
        used_days: number;
      }>;
    };
    const categoryRow = (effective.categories ?? []).find(
      (c) => c.leave_category === dto.leave_type,
    );
    const allocated = Number(categoryRow?.entitled_days ?? 0);
    const used = Number(categoryRow?.used_days ?? 0);
    const remaining = allocated - used;

    if (totalDays > remaining) {
      throw new BadRequestException(
        `Insufficient ${dto.leave_type} balance. Remaining: ${remaining} day(s), requested: ${totalDays}.`,
      );
    }

    const { data, error } = await supabase
      .from('time_leave_requests')
      .insert({
        request_id: crypto.randomUUID(),
        user_id: userId,
        company_id: companyId,
        leave_type: dto.leave_type,
        start_date: dto.start_date,
        end_date: dto.end_date,
        total_days: totalDays,
        reason: dto.reason ?? null,
        attachment_url: dto.attachment_url ?? null,
        is_retro: dto.is_retro ?? false,
        retro_reason: dto.retro_reason ?? null,
        status: 'Pending',
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    this.logger.log(
      `Leave request filed — user: ${userId}, type: ${dto.leave_type}, days: ${totalDays}`,
    );
    return data;
  }

  // ──────────────────────────────────────────────────────────────
  // EMPLOYEE: Get own leave requests
  // GET /leave/requests/me
  // ──────────────────────────────────────────────────────────────
  async getMyLeaveRequests(userId: string) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('time_leave_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    const rows = data ?? [];
    if (!rows.length) return rows;

    const reviewerIds = [...new Set(rows.map((r) => r.reviewed_by).filter(Boolean))];
    if (!reviewerIds.length) return rows;

    const { data: reviewers } = await supabase
      .from('user_profile')
      .select('user_id, first_name, last_name')
      .in('user_id', reviewerIds);

    const reviewerMap = new Map((reviewers ?? []).map((r) => [r.user_id, r]));
    return rows.map((row) => {
      const rv = reviewerMap.get(row.reviewed_by);
      return {
        ...row,
        reviewer_name: rv ? `${rv.first_name} ${rv.last_name}` : null,
      };
    });
  }

  // ──────────────────────────────────────────────────────────────
  // HR/Manager: Get all leave requests for company
  // GET /leave/requests?status=Pending
  // Manually joins user_profile because time_leave_requests.user_id
  // has no FK constraint in the database schema.
  // ──────────────────────────────────────────────────────────────
  async getLeaveRequests(companyId: string, status?: string) {
    const supabase = this.supabaseService.getClient();

    let query = supabase
      .from('time_leave_requests')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status) as typeof query;
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    if (!rows.length) return [];

    // Manually fetch employee profiles (no FK on user_id)
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const { data: profiles, error: profileErr } = await supabase
      .from('user_profile')
      .select('user_id, first_name, last_name, employee_id, email')
      .in('user_id', userIds);

    if (profileErr) {
      this.logger.warn(`Failed to fetch employee profiles: ${profileErr.message}`);
    }

    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.user_id, p]),
    );

    return rows.map((row) => ({
      ...row,
      employee: profileMap.get(row.user_id) ?? null,
    }));
  }

  // ──────────────────────────────────────────────────────────────
  // HR: Approve or reject a leave request
  // PATCH /leave/requests/:requestId
  // Also matches legacy route: PATCH /timekeeping/leave-requests/:logId
  // ──────────────────────────────────────────────────────────────
  async reviewLeaveRequest(
    requestId: string,
    reviewerId: string,
    companyId: string,
    dto: ReviewLeaveRequestDto,
  ) {
    const supabase = this.supabaseService.getClient();

    const { data: request, error: fetchErr } = await supabase
      .from('time_leave_requests')
      .select('*')
      .eq('request_id', requestId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (fetchErr) throw new Error(fetchErr.message);
    if (!request) throw new NotFoundException('Leave request not found.');
    if (request.status !== 'Pending') {
      throw new BadRequestException('This request has already been reviewed.');
    }

    const { data: updated, error: updateErr } = await supabase
      .from('time_leave_requests')
      .update({
        status: dto.status,
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
        rejection_reason: dto.rejection_reason ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('request_id', requestId)
      .select()
      .single();

    if (updateErr) throw new Error(updateErr.message);

    // If approved, deduct from balance and backfill past attendance
    if (dto.status === 'Approved') {
      await this.deductLeaveBalance(
        request.user_id,
        companyId,
        request.leave_type,
        Number(request.total_days),
        new Date(request.start_date).getFullYear(),
      );

      // Backfill attendance only for past date ranges
      const todayPH = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
      if (request.end_date <= todayPH) {
        await this.backfillAttendanceForLeave(
          request.user_id,
          request.start_date,
          request.end_date,
          request.leave_type,
          reviewerId,
        );
      }
    }

    this.logger.log(
      `Leave request ${dto.status} — request: ${requestId}, reviewer: ${reviewerId}`,
    );

    // Fire-and-forget email notification
    void (async () => {
      try {
        const [empProfile, rvProfile] = await Promise.all([
          supabase.from('user_profile').select('first_name, last_name, email').eq('user_id', request.user_id).maybeSingle(),
          supabase.from('user_profile').select('first_name, last_name').eq('user_id', reviewerId).maybeSingle(),
        ]);
        const emp = empProfile.data;
        const rv  = rvProfile.data;
        if (emp?.email) {
          await this.mailService.sendLeaveReviewEmail({
            to:              emp.email,
            employeeName:    `${emp.first_name} ${emp.last_name}`,
            reviewerName:    rv ? `${rv.first_name} ${rv.last_name}` : 'HR',
            status:          dto.status as 'Approved' | 'Rejected',
            leaveType:       request.leave_type,
            startDate:       request.start_date,
            endDate:         request.end_date,
            totalDays:       Number(request.total_days),
            rejectionReason: dto.rejection_reason ?? null,
          });
        }
      } catch (e) {
        this.logger.warn(`Leave review email failed: ${(e as Error).message}`);
      }
    })();

    return updated;
  }

  // ──────────────────────────────────────────────────────────────
  // EMPLOYEE: Cancel a pending leave request (instant, no HR needed)
  // PATCH /leave/requests/:requestId/cancel
  // ──────────────────────────────────────────────────────────────
  async cancelPendingLeave(requestId: string, userId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: request, error: fetchErr } = await supabase
      .from('time_leave_requests')
      .select('*')
      .eq('request_id', requestId)
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchErr) throw new Error(fetchErr.message);
    if (!request) throw new NotFoundException('Leave request not found.');
    if (request.status !== 'Pending') {
      throw new BadRequestException('Only pending requests can be cancelled directly.');
    }

    const { error: updateErr } = await supabase
      .from('time_leave_requests')
      .update({ status: 'Cancelled', updated_at: new Date().toISOString() })
      .eq('request_id', requestId);

    if (updateErr) throw new Error(updateErr.message);

    this.logger.log(`Pending leave cancelled — request: ${requestId}, user: ${userId}`);
    return { success: true };
  }

  // ──────────────────────────────────────────────────────────────
  // EMPLOYEE: Request revocation of an approved leave (future dates only)
  // PATCH /leave/requests/:requestId/request-revocation
  // ──────────────────────────────────────────────────────────────
  async requestLeaveRevocation(requestId: string, userId: string, reason: string) {
    const supabase = this.supabaseService.getClient();

    const { data: request, error: fetchErr } = await supabase
      .from('time_leave_requests')
      .select('*')
      .eq('request_id', requestId)
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchErr) throw new Error(fetchErr.message);
    if (!request) throw new NotFoundException('Leave request not found.');
    if (request.status !== 'Approved') {
      throw new BadRequestException('Only approved leave requests can have revocation requested.');
    }

    // Must be strictly future — start_date > today (PH time)
    const todayPH = new Date(
      new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }),
    );
    const startDate = new Date(request.start_date);
    if (startDate <= todayPH) {
      throw new BadRequestException(
        'Revocation can only be requested for future leave dates. Past or ongoing leave cannot be revoked.',
      );
    }

    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('A reason is required to request leave revocation.');
    }

    const { error: updateErr } = await supabase
      .from('time_leave_requests')
      .update({
        status: 'RevocationRequested',
        revocation_reason: reason.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('request_id', requestId);

    if (updateErr) throw new Error(updateErr.message);

    this.logger.log(`Leave revocation requested — request: ${requestId}, user: ${userId}`);
    return { success: true };
  }

  // ──────────────────────────────────────────────────────────────
  // HR: Approve or reject an employee's revocation request
  // PATCH /leave/requests/:requestId/review-revocation
  // ──────────────────────────────────────────────────────────────
  async reviewLeaveRevocation(
    requestId: string,
    reviewerId: string,
    companyId: string,
    action: 'approve' | 'reject',
  ) {
    const supabase = this.supabaseService.getClient();

    const { data: request, error: fetchErr } = await supabase
      .from('time_leave_requests')
      .select('*')
      .eq('request_id', requestId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (fetchErr) throw new Error(fetchErr.message);
    if (!request) throw new NotFoundException('Leave request not found.');
    if (request.status !== 'RevocationRequested') {
      throw new BadRequestException('This request is not pending revocation review.');
    }

    if (action === 'approve') {
      await supabase
        .from('time_leave_requests')
        .update({
          status: 'Revoked',
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('request_id', requestId);

      // Refund leave balance
      await this.refundLeaveBalance(
        request.user_id,
        companyId,
        request.leave_type,
        Number(request.total_days),
        new Date(request.start_date).getFullYear(),
      );

      this.logger.log(`Leave revocation approved — request: ${requestId}, reviewer: ${reviewerId}`);
    } else {
      // Reject revocation — restore to Approved
      await supabase
        .from('time_leave_requests')
        .update({
          status: 'Approved',
          revocation_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq('request_id', requestId);

      this.logger.log(`Leave revocation rejected — request: ${requestId}, reviewer: ${reviewerId}`);
    }

    return { success: true, action };
  }

  // ──────────────────────────────────────────────────────────────
  // Internal: Backfill attendance for approved past leave
  // Finds absence logs in [startDate, endDate] for the employee
  // and marks them EXCUSED so absent count is not double-penalized
  // ──────────────────────────────────────────────────────────────
  private async backfillAttendanceForLeave(
    userId: string,
    startDate: string,
    endDate: string,
    leaveType: string,
    reviewerId: string,
  ) {
    const supabase = this.supabaseService.getClient();

    // Resolve employee_id (text key used by attendance_time_logs)
    const { data: profile } = await supabase
      .from('user_profile')
      .select('employee_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!profile?.employee_id) {
      this.logger.warn(`backfillAttendance: no employee_id for user ${userId}`);
      return;
    }

    const rangeStart = `${startDate}T00:00:00.000+08:00`;
    const rangeEnd   = `${endDate}T23:59:59.999+08:00`;

    const { error } = await supabase
      .from('attendance_time_logs')
      .update({
        status:        'EXCUSED',
        log_status:    'EXCUSED',
        absence_reason: leaveType,
        reviewed_by:   reviewerId,
        reviewed_at:   new Date().toISOString(),
        review_reason: `Approved ${leaveType} — retroactive leave`,
      })
      .eq('employee_id', profile.employee_id)
      .eq('log_type', 'absence')
      .gte('timestamp', rangeStart)
      .lte('timestamp', rangeEnd);

    if (error) {
      this.logger.warn(`backfillAttendance failed for ${profile.employee_id}: ${error.message}`);
    } else {
      this.logger.log(
        `Attendance backfilled — employee: ${profile.employee_id}, range: ${startDate}–${endDate}, type: ${leaveType}`,
      );
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Internal: Deduct used days from time_leave_balances
  // ──────────────────────────────────────────────────────────────
  private async deductLeaveBalance(
    userId: string,
    companyId: string,
    leaveType: string,
    days: number,
    year: number,
  ) {
    const supabase = this.supabaseService.getClient();

    const { data: existing } = await supabase
      .from('time_leave_balances')
      .select('balance_id, allocated_days, used_days')
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .eq('leave_type', leaveType)
      .eq('year', year)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('time_leave_balances')
        .update({
          used_days: Number(existing.used_days) + days,
          updated_at: new Date().toISOString(),
        })
        .eq('balance_id', existing.balance_id);
    } else {
      // Seed a row on first use if not yet created
      const defaultAllocated = DEFAULT_LEAVE_ALLOCATIONS[leaveType] ?? 0;
      await supabase.from('time_leave_balances').insert({
        balance_id: crypto.randomUUID(),
        user_id: userId,
        company_id: companyId,
        leave_type: leaveType,
        year,
        allocated_days: defaultAllocated,
        used_days: days,
      });
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Internal: Refund days back to time_leave_balances (on revoke)
  // ──────────────────────────────────────────────────────────────
  private async refundLeaveBalance(
    userId: string,
    companyId: string,
    leaveType: string,
    days: number,
    year: number,
  ) {
    const supabase = this.supabaseService.getClient();

    const { data: existing } = await supabase
      .from('time_leave_balances')
      .select('balance_id, used_days')
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .eq('leave_type', leaveType)
      .eq('year', year)
      .maybeSingle();

    if (existing) {
      const newUsed = Math.max(0, Number(existing.used_days) - days);
      await supabase
        .from('time_leave_balances')
        .update({ used_days: newUsed, updated_at: new Date().toISOString() })
        .eq('balance_id', existing.balance_id);
    }
  }

  // ──────────────────────────────────────────────────────────────
  // HR: Seed default leave balances when a new employee joins
  // Called from onboarding touchpoint
  // ──────────────────────────────────────────────────────────────
  async uploadLeaveAttachment(userId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded.');

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Only JPG, PNG, WebP, or PDF allowed.');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('File too large. Maximum size is 5MB.');
    }

    const supabase = this.supabaseService.getClient();
    const bucket = 'leave-attachments';

    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) throw new InternalServerErrorException(listError.message);

    const exists = buckets?.some((b) => b.name === bucket);
    if (!exists) {
      const { error: createError } = await supabase.storage.createBucket(bucket, {
        public: true,
        fileSizeLimit: 5 * 1024 * 1024,
        allowedMimeTypes: allowedTypes,
      });
      if (createError) throw new InternalServerErrorException(createError.message);
    }

    const ext = file.originalname.split('.').pop()?.toLowerCase() ?? 'file';
    const filePath = `${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: false });

    if (uploadError) throw new BadRequestException(`Upload failed: ${uploadError.message}`);

    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(filePath);
    this.logger.log(`Leave attachment uploaded — user: ${userId}, path: ${filePath}`);
    return { url: publicData.publicUrl };
  }

  async seedLeaveBalancesForNewEmployee(userId: string, companyId: string) {
    const supabase = this.supabaseService.getClient();
    const year = new Date().getFullYear();

    const rows = Object.entries(DEFAULT_LEAVE_ALLOCATIONS).map(
      ([leaveType, allocated]) => ({
        balance_id: crypto.randomUUID(),
        user_id: userId,
        company_id: companyId,
        leave_type: leaveType,
        year,
        allocated_days: allocated,
        used_days: 0,
      }),
    );

    const { error } = await supabase
      .from('time_leave_balances')
      .upsert(rows, { onConflict: 'user_id,company_id,leave_type,year' });

    if (error) {
      this.logger.warn(
        `Failed to seed leave balances for ${userId}: ${error.message}`,
      );
    }
  }
}
