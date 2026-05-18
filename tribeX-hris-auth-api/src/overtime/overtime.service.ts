import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { MailService } from '../mail/mail.service';
import { DatabaseErrorHandler } from '../common/database-error.handler';
import { FileOvertimeRequestDto, OvertimeType } from './dto/file-overtime-request.dto';
import { ReviewOvertimeRequestDto, OvertimeReviewAction } from './dto/review-overtime-request.dto';

type OvertimeRow = {
  ot_id: string;
  employee_id: string;
  ot_type: OvertimeType;
  ot_date: string;
  start_time: string;
  end_time: string;
  planned_hours: number;
  reason: string | null;
  log_status: 'PENDING' | 'APPROVED' | 'DENIED';
  latitude: number | null;
  longitude: number | null;
  ip_address: string | null;
  requested_by: string;
  created_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_reason: string | null;
};

function getManilaDateString(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(date);
}

function getIp(req?: any): string | null {
  if (!req) return null;
  const xf = req.headers?.['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) return xf.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || null;
}

function computePlannedHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  if (endMin <= startMin) {
    throw new BadRequestException(
      'Overnight overtime is not supported. End time must be after start time.',
    );
  }
  const hours = (endMin - startMin) / 60;
  if (hours <= 0 || hours > 24) {
    throw new BadRequestException('Planned hours must be between 0 and 24.');
  }
  return Math.round(hours * 100) / 100;
}

function normalizeWorkdays(workdays: string | string[] | null | undefined): string[] {
  if (!workdays) return [];
  const normalize = (d: string) => {
    const s = d.trim().toUpperCase();
    if (s === 'TUES') return 'TUE';
    if (s === 'THURS') return 'THU';
    return s;
  };
  if (Array.isArray(workdays)) return workdays.map(normalize);
  return String(workdays).split(',').map(normalize);
}

function isScheduledForDate(
  workdays: string | string[] | null | undefined,
  dateStr: string,
): boolean {
  const dayCode = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'Asia/Manila',
  })
    .format(new Date(`${dateStr}T00:00:00+08:00`))
    .toUpperCase();
  const normalized = normalizeWorkdays(workdays);
  return normalized.includes(dayCode);
}

const SCHEDULE_SELECT_FIELDS =
  'sched_id, employee_id, effective_from, workdays, start_time, end_time, break_start, break_end, is_nightshift, schedule_source, updated_by_name, updated_at';

@Injectable()
export class OvertimeService {
  private readonly logger = new Logger(OvertimeService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly mailService: MailService,
  ) {}

  private async getEmployeeId(userId: string): Promise<string | null> {
    const { data } = await this.supabaseService
      .getClient()
      .from('user_profile')
      .select('employee_id')
      .eq('user_id', userId)
      .maybeSingle();
    return data?.employee_id ?? null;
  }

  private async getScheduleForEmployee(employeeId: string, asOfDate: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('schedules')
      .select(SCHEDULE_SELECT_FIELDS)
      .eq('employee_id', employeeId)
      .lte('effective_from', asOfDate)
      .order('effective_from', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ?? null;
  }

  async createOvertimeRequest(
    userId: string,
    dto: FileOvertimeRequestDto,
    req?: any,
  ) {
    const supabase = this.supabaseService.getClient();
    const today = getManilaDateString();

    const employeeId = await this.getEmployeeId(userId);
    if (!employeeId) throw new BadRequestException('Employee profile not found.');

    // Must be future date
    if (dto.ot_date <= today) {
      throw new BadRequestException(
        'Overtime must be requested in advance — date must be after today.',
      );
    }

    const plannedHours = computePlannedHours(dto.start_time, dto.end_time);

    // Schedule-type validation
    if (dto.ot_type === OvertimeType.NORMAL || dto.ot_type === OvertimeType.REST_DAY) {
      const schedule = await this.getScheduleForEmployee(employeeId, dto.ot_date);
      if (!schedule) {
        throw new BadRequestException(
          'No schedule assigned. Cannot validate overtime type without a schedule.',
        );
      }
      const isWorkday = isScheduledForDate(schedule.workdays, dto.ot_date);
      if (dto.ot_type === OvertimeType.NORMAL && !isWorkday) {
        throw new BadRequestException(
          'NORMAL overtime must be on a scheduled workday.',
        );
      }
      if (dto.ot_type === OvertimeType.REST_DAY && isWorkday) {
        throw new BadRequestException(
          'REST_DAY overtime must be on a rest day (non-workday).',
        );
      }
    }

    // Overlap guard: PENDING or APPROVED OT on same date with overlapping window
    const dayStart = `${dto.ot_date}T00:00:00.000+08:00`;
    const dayEnd   = `${dto.ot_date}T23:59:59.999+08:00`;

    const { data: existing } = await supabase
      .from('overtime_requests')
      .select('ot_id, start_time, end_time')
      .eq('employee_id', employeeId)
      .in('log_status', ['PENDING', 'APPROVED'])
      .gte('ot_date', dto.ot_date)
      .lte('ot_date', dto.ot_date);

    for (const row of existing ?? []) {
      const [rsh, rsm] = (row.start_time as string).split(':').map(Number);
      const [reh, rem] = (row.end_time as string).split(':').map(Number);
      const [nsh, nsm] = dto.start_time.split(':').map(Number);
      const [neh, nem] = dto.end_time.split(':').map(Number);
      const rsMin = rsh * 60 + rsm;
      const reMin = reh * 60 + rem;
      const nsMin = nsh * 60 + nsm;
      const neMin = neh * 60 + nem;
      if (nsMin < reMin && neMin > rsMin) {
        throw new BadRequestException(
          'An overlapping overtime request already exists for that date and time window.',
        );
      }
    }

    // Absence conflict: non-denied absence log on same date
    const { data: absences } = await supabase
      .from('attendance_time_logs')
      .select('log_id')
      .eq('employee_id', employeeId)
      .eq('log_type', 'absence')
      .neq('log_status', 'DENIED')
      .gte('timestamp', dayStart)
      .lte('timestamp', dayEnd)
      .limit(1);

    if ((absences ?? []).length > 0) {
      throw new BadRequestException(
        `You have an absence record on ${dto.ot_date}. Cannot request overtime on the same date.`,
      );
    }

    const otId = crypto.randomUUID();
    const { error: insertError } = await supabase.from('overtime_requests').insert({
      ot_id: otId,
      employee_id: employeeId,
      ot_type: dto.ot_type,
      ot_date: dto.ot_date,
      start_time: dto.start_time,
      end_time: dto.end_time,
      planned_hours: plannedHours,
      reason: dto.reason ?? null,
      log_status: 'PENDING',
      latitude: dto.latitude,
      longitude: dto.longitude,
      ip_address: getIp(req),
      requested_by: userId,
    });

    if (insertError) DatabaseErrorHandler.handle(insertError, 'createOvertimeRequest', this.logger);

    this.logger.log(
      `OT request created — employee: ${employeeId}, date: ${dto.ot_date}, type: ${dto.ot_type}, hours: ${plannedHours}`,
    );

    return {
      ot_id: otId,
      employee_id: employeeId,
      ot_type: dto.ot_type,
      ot_date: dto.ot_date,
      start_time: dto.start_time,
      end_time: dto.end_time,
      planned_hours: plannedHours,
      reason: dto.reason ?? null,
      log_status: 'PENDING',
    };
  }

  async getMyOvertimeRequests(userId: string): Promise<OvertimeRow[]> {
    const employeeId = await this.getEmployeeId(userId);
    if (!employeeId) return [];

    const { data, error } = await this.supabaseService
      .getClient()
      .from('overtime_requests')
      .select('*')
      .eq('employee_id', employeeId)
      .order('ot_date', { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as OvertimeRow[];
  }

  async getMyOvertimeSummary(userId: string, month?: string): Promise<{ approved_planned_hours: number }> {
    const employeeId = await this.getEmployeeId(userId);
    if (!employeeId) return { approved_planned_hours: 0 };

    const targetMonth = month ?? getManilaDateString().slice(0, 7);
    const [year, mon] = targetMonth.split('-').map(Number);
    const firstDay = `${targetMonth}-01`;
    const lastDay = new Date(year, mon, 0).toISOString().split('T')[0];

    const { data, error } = await this.supabaseService
      .getClient()
      .from('overtime_requests')
      .select('planned_hours')
      .eq('employee_id', employeeId)
      .eq('log_status', 'APPROVED')
      .gte('ot_date', firstDay)
      .lte('ot_date', lastDay);

    if (error) throw new Error(error.message);

    const approved_planned_hours = (data ?? []).reduce(
      (sum, r: any) => sum + Number(r.planned_hours),
      0,
    );
    return { approved_planned_hours };
  }

  async getOvertimeRequests(
    companyId: string,
    status?: string,
    type?: string,
  ) {
    const supabase = this.supabaseService.getClient();

    // Resolve employee_ids for this company
    const { data: profiles } = await supabase
      .from('user_profile')
      .select('employee_id, user_id, first_name, last_name')
      .eq('company_id', companyId)
      .not('employee_id', 'is', null);

    const allProfiles = profiles ?? [];
    if (!allProfiles.length) return [];

    const employeeIds = allProfiles.map((p) => p.employee_id as string);
    const profileMap = new Map(allProfiles.map((p) => [p.employee_id as string, p]));

    let query = supabase
      .from('overtime_requests')
      .select('*')
      .in('employee_id', employeeIds)
      .order('ot_date', { ascending: false });

    if (status && status !== 'ALL') {
      query = query.eq('log_status', status.toUpperCase()) as typeof query;
    } else if (!status) {
      query = query.eq('log_status', 'PENDING') as typeof query;
    }

    if (type) {
      query = query.eq('ot_type', type.toUpperCase()) as typeof query;
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return (data ?? []).map((row: any) => ({
      ...row,
      employee: profileMap.get(row.employee_id) ?? null,
    }));
  }

  async reviewOvertimeRequest(
    otId: string,
    dto: ReviewOvertimeRequestDto,
    companyId: string,
    reviewerUserId: string,
  ) {
    const supabase = this.supabaseService.getClient();

    if (dto.action === OvertimeReviewAction.DENY && (!dto.review_reason || dto.review_reason.trim().length < 3)) {
      throw new BadRequestException('A reason of at least 3 characters is required when denying.');
    }

    const { data: target, error: fetchError } = await supabase
      .from('overtime_requests')
      .select('*')
      .eq('ot_id', otId)
      .maybeSingle<OvertimeRow>();

    if (fetchError) throw new Error(fetchError.message);
    if (!target) throw new NotFoundException('Overtime request not found.');
    if (target.log_status !== 'PENDING') {
      throw new BadRequestException('This request has already been reviewed.');
    }

    // Verify employee belongs to company
    const { data: owner } = await supabase
      .from('user_profile')
      .select('user_id, company_id, first_name, last_name, email')
      .eq('employee_id', target.employee_id)
      .eq('company_id', companyId)
      .maybeSingle();

    if (!owner) throw new NotFoundException('Overtime request not found in your company.');

    const nextStatus = dto.action === OvertimeReviewAction.APPROVE ? 'APPROVED' : 'DENIED';

    const [{ data: updated, error: updateError }, { data: reviewer }] = await Promise.all([
      supabase
        .from('overtime_requests')
        .update({
          log_status: nextStatus,
          reviewed_by: reviewerUserId,
          reviewed_at: new Date().toISOString(),
          review_reason: dto.review_reason ?? null,
        })
        .eq('ot_id', otId)
        .select('*')
        .maybeSingle<OvertimeRow>(),
      supabase
        .from('user_profile')
        .select('first_name, last_name')
        .eq('user_id', reviewerUserId)
        .maybeSingle(),
    ]);

    if (updateError) throw new Error(updateError.message);
    if (!updated) throw new NotFoundException('Overtime request not found.');

    const reviewerName = reviewer
      ? `${reviewer.first_name} ${reviewer.last_name}`
      : 'HR';

    if (owner.email) {
      this.mailService
        .sendOvertimeReviewEmail({
          to: owner.email,
          employeeName: `${owner.first_name} ${owner.last_name}`,
          reviewerName,
          action: nextStatus as 'APPROVED' | 'DENIED',
          otType: target.ot_type,
          otDate: target.ot_date,
          startTime: target.start_time,
          endTime: target.end_time,
          plannedHours: Number(target.planned_hours),
          reason: dto.review_reason ?? null,
        })
        .catch((err: unknown) =>
          this.logger.warn(`OT review email failed: ${err instanceof Error ? err.message : String(err)}`),
        );
    }

    this.logger.log(
      `OT request ${nextStatus} — id: ${otId}, reviewer: ${reviewerUserId}`,
    );

    return { ...updated, employee: owner };
  }

  /** For timekeeping rest-day gate: returns the single APPROVED OT for a given employee+date or null */
  async getApprovedOvertimeForDate(
    employeeId: string,
    dateStr: string,
  ): Promise<OvertimeRow | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('overtime_requests')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('ot_date', dateStr)
      .eq('log_status', 'APPROVED')
      .limit(1)
      .maybeSingle<OvertimeRow>();

    if (error) return null;
    return data ?? null;
  }

  /** For payroll: sum approved planned_hours in a date range */
  async getApprovedOtHoursForPeriod(
    employeeId: string,
    startDate: string,
    endDate: string,
  ): Promise<number> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('overtime_requests')
      .select('planned_hours')
      .eq('employee_id', employeeId)
      .eq('log_status', 'APPROVED')
      .gte('ot_date', startDate)
      .lte('ot_date', endDate);

    if (error) return 0;
    return (data ?? []).reduce((sum, r: any) => sum + Number(r.planned_hours), 0);
  }
}
