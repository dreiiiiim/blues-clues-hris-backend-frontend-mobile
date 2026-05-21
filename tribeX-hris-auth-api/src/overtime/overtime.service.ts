import * as crypto from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseErrorHandler } from '../common/database-error.handler';
import { MailService } from '../mail/mail.service';
import { SupabaseService } from '../supabase/supabase.service';
import { FileOvertimeRequestDto, OvertimeType } from './dto/file-overtime-request.dto';
import { OvertimeReviewAction, ReviewOvertimeRequestDto } from './dto/review-overtime-request.dto';

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

const SCHEDULE_SELECT_FIELDS =
  'sched_id, employee_id, effective_from, workdays, start_time, end_time, break_start, break_end, is_nightshift, schedule_source, updated_by_name, updated_at';

function getManilaDateString(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(date);
}

function getIpAddress(req?: unknown): string | null {
  if (!req || typeof req !== 'object') return null;
  const request = req as {
    headers?: Record<string, string | string[] | undefined>;
    ip?: string;
    socket?: { remoteAddress?: string };
  };
  const forwardedFor = request.headers?.['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    return forwardedFor.split(',')[0]?.trim() ?? null;
  }
  return request.ip ?? request.socket?.remoteAddress ?? null;
}

function computePlannedHours(startTime: string, endTime: string): number {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;

  if (endTotal <= startTotal) {
    throw new BadRequestException('End time must be after start time.');
  }

  const hours = (endTotal - startTotal) / 60;
  if (hours <= 0 || hours > 24) {
    throw new BadRequestException('Planned hours must be between 0 and 24.');
  }

  return Math.round(hours * 100) / 100;
}

function normalizeWorkdays(workdays: string | string[] | null | undefined): string[] {
  if (!workdays) return [];
  const normalize = (value: string) => {
    const day = value.trim().toUpperCase();
    if (day === 'TUES') return 'TUE';
    if (day === 'THURS') return 'THU';
    return day;
  };

  if (Array.isArray(workdays)) return workdays.map(normalize);
  return String(workdays)
    .split(',')
    .map(normalize);
}

function isScheduledForDate(workdays: string | string[] | null | undefined, dateStr: string): boolean {
  const dayCode = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'Asia/Manila',
  })
    .format(new Date(`${dateStr}T00:00:00+08:00`))
    .toUpperCase();

  return normalizeWorkdays(workdays).includes(dayCode);
}

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

  async createOvertimeRequest(userId: string, dto: FileOvertimeRequestDto, req?: unknown) {
    const supabase = this.supabaseService.getClient();
    const today = getManilaDateString();
    const employeeId = await this.getEmployeeId(userId);

    if (!employeeId) {
      throw new BadRequestException('Employee profile not found.');
    }

    if (dto.ot_date <= today) {
      throw new BadRequestException('Overtime must be requested in advance.');
    }

    const plannedHours = computePlannedHours(dto.start_time, dto.end_time);

    if (dto.ot_type === OvertimeType.NORMAL || dto.ot_type === OvertimeType.REST_DAY) {
      const schedule = await this.getScheduleForEmployee(employeeId, dto.ot_date);
      if (!schedule) {
        throw new BadRequestException('No schedule assigned for this employee.');
      }

      const isWorkday = isScheduledForDate(schedule.workdays, dto.ot_date);
      if (dto.ot_type === OvertimeType.NORMAL && !isWorkday) {
        throw new BadRequestException('Normal overtime must be on a scheduled workday.');
      }
      if (dto.ot_type === OvertimeType.REST_DAY && isWorkday) {
        throw new BadRequestException('Rest day overtime must be on a rest day.');
      }
    }

    const { data: existing } = await supabase
      .from('overtime_requests')
      .select('ot_id, start_time, end_time')
      .eq('employee_id', employeeId)
      .eq('ot_date', dto.ot_date)
      .in('log_status', ['PENDING', 'APPROVED']);

    for (const row of existing ?? []) {
      const existingStart = row.start_time.split(':').map(Number);
      const existingEnd = row.end_time.split(':').map(Number);
      const nextStart = dto.start_time.split(':').map(Number);
      const nextEnd = dto.end_time.split(':').map(Number);
      const existingStartMinutes = existingStart[0] * 60 + existingStart[1];
      const existingEndMinutes = existingEnd[0] * 60 + existingEnd[1];
      const nextStartMinutes = nextStart[0] * 60 + nextStart[1];
      const nextEndMinutes = nextEnd[0] * 60 + nextEnd[1];

      if (nextStartMinutes < existingEndMinutes && nextEndMinutes > existingStartMinutes) {
        throw new BadRequestException(
          'An overlapping overtime request already exists for that date and time window.',
        );
      }
    }

    const dayStart = `${dto.ot_date}T00:00:00.000+08:00`;
    const dayEnd = `${dto.ot_date}T23:59:59.999+08:00`;
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
      throw new BadRequestException('Cannot request overtime on a date with an absence record.');
    }

    const otId = crypto.randomUUID();
    const { error } = await supabase.from('overtime_requests').insert({
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
      ip_address: getIpAddress(req),
      requested_by: userId,
    });

    if (error) {
      DatabaseErrorHandler.handle(error, 'createOvertimeRequest', this.logger);
    }

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

  async getMyOvertimeSummary(
    userId: string,
    month?: string,
  ): Promise<{ approved_planned_hours: number }> {
    const employeeId = await this.getEmployeeId(userId);
    if (!employeeId) return { approved_planned_hours: 0 };

    const targetMonth = month ?? getManilaDateString().slice(0, 7);
    const [year, monthNumber] = targetMonth.split('-').map(Number);
    const firstDay = `${targetMonth}-01`;
    const lastDay = new Date(year, monthNumber, 0).toISOString().split('T')[0];

    const { data, error } = await this.supabaseService
      .getClient()
      .from('overtime_requests')
      .select('planned_hours')
      .eq('employee_id', employeeId)
      .eq('log_status', 'APPROVED')
      .gte('ot_date', firstDay)
      .lte('ot_date', lastDay);

    if (error) throw new Error(error.message);

    const approvedPlannedHours = (data ?? []).reduce(
      (sum, row: { planned_hours: number | string }) => sum + Number(row.planned_hours),
      0,
    );

    return { approved_planned_hours: approvedPlannedHours };
  }

  async getOvertimeRequests(companyId: string, status?: string, type?: string) {
    const supabase = this.supabaseService.getClient();
    const { data: profiles } = await supabase
      .from('user_profile')
      .select('employee_id, user_id, first_name, last_name')
      .eq('company_id', companyId)
      .not('employee_id', 'is', null);

    const allProfiles = profiles ?? [];
    if (allProfiles.length === 0) return [];

    const employeeIds = allProfiles.map((profile) => profile.employee_id as string);
    const profileMap = new Map(allProfiles.map((profile) => [profile.employee_id as string, profile]));

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

    return (data ?? []).map((row: { employee_id: string }) => ({
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

    if (
      dto.action === OvertimeReviewAction.DENY &&
      (!dto.review_reason || dto.review_reason.trim().length < 3)
    ) {
      throw new BadRequestException('A denial reason with at least 3 characters is required.');
    }

    const { data: target, error: fetchError } = await supabase
      .from('overtime_requests')
      .select('*')
      .eq('ot_id', otId)
      .maybeSingle<OvertimeRow>();

    if (fetchError) throw new Error(fetchError.message);
    if (!target) throw new NotFoundException('Overtime request not found.');
    if (target.log_status !== 'PENDING') {
      throw new BadRequestException('This overtime request has already been reviewed.');
    }

    const { data: owner } = await supabase
      .from('user_profile')
      .select('user_id, company_id, first_name, last_name, email, employee_id')
      .eq('employee_id', target.employee_id)
      .eq('company_id', companyId)
      .maybeSingle();

    if (!owner) {
      throw new NotFoundException('Overtime request not found in your company.');
    }

    const nextStatus = dto.action === OvertimeReviewAction.APPROVE ? 'APPROVED' : 'DENIED';
    const { data: updated, error: updateError } = await supabase
      .from('overtime_requests')
      .update({
        log_status: nextStatus,
        reviewed_by: reviewerUserId,
        reviewed_at: new Date().toISOString(),
        review_reason: dto.review_reason ?? null,
      })
      .eq('ot_id', otId)
      .select('*')
      .maybeSingle<OvertimeRow>();

    if (updateError) throw new Error(updateError.message);
    if (!updated) throw new NotFoundException('Overtime request not found.');

    this.logger.log(`Overtime request ${nextStatus}: ${otId}`);

    // Fire-and-forget email notification
    void (async () => {
      try {
        if (owner?.email) {
          const reviewer = await this.supabaseService
            .getClient()
            .from('user_profile')
            .select('first_name, last_name')
            .eq('user_id', reviewerUserId)
            .maybeSingle();

          const typeMap: Record<string, string> = {
            NORMAL: 'Normal Overtime',
            REST_DAY: 'Rest Day Overtime',
            HOLIDAY: 'Holiday Overtime',
          };

          await this.mailService.sendOvertimeReviewEmail({
            to: owner.email,
            employeeName: `${owner.first_name} ${owner.last_name}`,
            reviewerName: reviewer.data ? `${reviewer.data.first_name} ${reviewer.data.last_name}` : 'HR',
            status: nextStatus as 'APPROVED' | 'DENIED',
            overtimeType: updated.ot_type,
            otDate: updated.ot_date,
            startTime: updated.start_time,
            endTime: updated.end_time,
            plannedHours: updated.planned_hours,
            denialReason: dto.review_reason ?? null,
          });
        }
      } catch (e) {
        this.logger.warn(`Overtime review email failed: ${(e as Error).message}`);
      }
    })();

    return {
      ...updated,
      employee: owner,
    };
  }
}
