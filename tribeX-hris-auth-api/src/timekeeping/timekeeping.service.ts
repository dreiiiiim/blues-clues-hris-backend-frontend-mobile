import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { TimePunchDto } from './dto/time-punch.dto';
import { ReportAbsenceDto } from './dto/report-absence.dto';
import { UpsertScheduleDto } from './dto/upsert-schedule.dto';
import { BulkScheduleDto } from './dto/bulk-schedule.dto';
import { ScheduleEffectiveDateDto } from './dto/schedule-effective-date.dto';

type AttendanceLogType = 'time-in' | 'time-out' | 'break-start' | 'break-end' | 'absence';
type ClockType = 'ON-TIME' | 'LATE' | 'EARLY' | 'OVERTIME';

type TimeLogRow = {
  log_id: string;
  employee_id: string | null;
  schedule_id: string | null;
  log_type: AttendanceLogType;
  timestamp: string;
  latitude: number | null;
  longitude: number | null;
  ip_address: string | null;
  is_mock_location: boolean;
  clock_type?: ClockType | null;
  status?: string | null;
  log_status: string | null;
  absence_reason?: string | null;
  absence_notes?: string | null;
};

type ScheduleRow = {
  sched_id: string;
  employee_id: string;
  effective_from?: string | null;
  workdays: string | string[] | null;
  start_time: string | null;
  end_time: string | null;
  break_start?: string | null;
  break_end?: string | null;
  is_nightshift: boolean | null;
  schedule_source?: 'bulk' | 'department' | 'individual' | 'default' | null;
  updated_by_name?: string | null;
  updated_at?: string | null;
};

type EmployeeDepartmentRelation =
  | { department_name?: string | null }
  | Array<{ department_name?: string | null }>
  | null
  | undefined;

type EmployeeUserRow = {
  user_id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string | null;
  department_id: string | null;
  department?: EmployeeDepartmentRelation;
  department_name?: string | null;
};

function normalizeScheduleRow(
  schedule: ScheduleRow | null,
): ScheduleRow | null {
  if (!schedule) return null;
  return {
    ...schedule,
    effective_from: schedule.effective_from ?? null,
    schedule_source: schedule.schedule_source ?? 'default',
  };
}

function normalizeDepartmentName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const normalized = name.trim();
  return normalized.length ? normalized : null;
}

function extractDepartmentNameFromRelation(
  relation: EmployeeDepartmentRelation,
): string | null {
  if (!relation) return null;
  if (Array.isArray(relation)) {
    return normalizeDepartmentName(relation[0]?.department_name);
  }
  return normalizeDepartmentName(relation.department_name);
}

function normalizeEmployeeUserRow(row: EmployeeUserRow): EmployeeUserRow {
  const department_name =
    normalizeDepartmentName(row.department_name) ??
    extractDepartmentNameFromRelation(row.department);

  return {
    ...row,
    department_name,
    department: department_name ? { department_name } : null,
  };
}

function getIp(req?: any): string | null {
  if (!req) return null;
  const xf = req.headers?.['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) return xf.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || null;
}

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    date: start.toISOString().split('T')[0],
  };
}

const SCHEDULE_SELECT_FIELDS =
  'sched_id, employee_id, effective_from, workdays, start_time, end_time, break_start, break_end, is_nightshift, schedule_source, updated_by_name, updated_at';

@Injectable()
export class TimekeepingService {
  private readonly logger = new Logger(TimekeepingService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private async getEmployeeId(userId: string): Promise<string | null> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('user_profile')
      .select('employee_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data?.employee_id ?? null;
  }

  private getManilaDateString(date = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(date);
  }

  private getManilaWorkdayCode(asOfDate: string): string {
    const safeDate = new Date(`${asOfDate}T00:00:00+08:00`);
    const shortWeekday = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      timeZone: 'Asia/Manila',
    })
      .format(safeDate)
      .toUpperCase();

    const dayCodeMap: Record<string, string> = {
      SUN: 'SUN',
      MON: 'MON',
      TUE: 'TUE',
      WED: 'WED',
      THU: 'THU',
      FRI: 'FRI',
      SAT: 'SAT',
    };

    return dayCodeMap[shortWeekday] ?? 'MON';
  }

  private resolveEffectiveDate(rawDate?: string | null): string {
    const todayInManila = this.getManilaDateString();
    if (!rawDate) return todayInManila;

    const normalized = String(rawDate).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      throw new BadRequestException('effective_date must be in YYYY-MM-DD format.');
    }
    if (normalized < todayInManila) {
      throw new BadRequestException('effective_date cannot be in the past.');
    }
    return normalized;
  }

  private normalizeWorkdays(
    workdays: string | string[] | null | undefined,
  ): string[] {
    if (!workdays) return [];

    if (Array.isArray(workdays)) {
      return workdays.map((d) => {
        const day = String(d).trim().toUpperCase();
        if (day === 'TUES') return 'TUE';
        if (day === 'THURS') return 'THU';
        return day;
      });
    }

    return String(workdays)
      .split(',')
      .map((d) => {
        const day = d.trim().toUpperCase();
        if (day === 'TUES') return 'TUE';
        if (day === 'THURS') return 'THU';
        return day;
      })
      .filter(Boolean);
  }

  private isScheduledForDate(
    workdays: string | string[] | null | undefined,
    asOfDate: string,
  ): boolean {
    const todayCode = this.getManilaWorkdayCode(asOfDate);
    const normalized = this.normalizeWorkdays(workdays);

    return normalized.includes(todayCode);
  }

  private parseScheduleTime(
    baseDate: Date,
    rawTime: string | null | undefined,
  ): Date | null {
    if (!rawTime) return null;

    const timeStr = String(rawTime).trim();

    const fullDate = new Date(timeStr);
    if (!Number.isNaN(fullDate.getTime()) && timeStr.includes('T')) {
      return fullDate;
    }

    const militaryMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(timeStr);
    if (militaryMatch) {
      const [, hh, mm, ss] = militaryMatch;
      const d = new Date(baseDate);
      d.setHours(Number(hh), Number(mm), Number(ss ?? 0), 0);
      return d;
    }

    const ampmMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i.exec(timeStr);
    if (ampmMatch) {
      let [, hh, mm, ss, ampm] = ampmMatch;
      let hour = Number(hh);

      if (ampm.toUpperCase() === 'AM') {
        if (hour === 12) hour = 0;
      } else if (hour !== 12) {
        hour += 12;
      }

      const d = new Date(baseDate);
      d.setHours(hour, Number(mm), Number(ss ?? 0), 0);
      return d;
    }

    return null;
  }

  private buildScheduleWindow(schedule: ScheduleRow, now = new Date()) {
    const baseDate = new Date(now);

    const shiftStart = this.parseScheduleTime(baseDate, schedule.start_time);
    const shiftEnd = this.parseScheduleTime(baseDate, schedule.end_time);

    if (!shiftStart || !shiftEnd) {
      throw new BadRequestException(
        'Employee schedule has invalid start/end time.',
      );
    }

    if (schedule.is_nightshift && shiftEnd <= shiftStart) {
      shiftEnd.setDate(shiftEnd.getDate() + 1);
    }

    return { shiftStart, shiftEnd };
  }

  private computeClockTypeForTimeIn(
    now: Date,
    schedule: ScheduleRow,
  ): ClockType {
    const { shiftStart } = this.buildScheduleWindow(schedule, now);

    if (now.getTime() > shiftStart.getTime()) return 'LATE';
    return 'ON-TIME';
  }

  private computeClockTypeForTimeOut(
    now: Date,
    schedule: ScheduleRow,
  ): ClockType {
    const { shiftEnd } = this.buildScheduleWindow(schedule, now);

    if (now.getTime() < shiftEnd.getTime()) return 'EARLY';
    if (now.getTime() > shiftEnd.getTime()) return 'OVERTIME';
    return 'ON-TIME';
  }

  private async getScheduleForEmployee(
    employeeId: string,
    asOfDate?: string,
  ): Promise<ScheduleRow | null> {
    const supabase = this.supabaseService.getClient();
    const effectiveDate = asOfDate ?? this.getManilaDateString();

    const { data, error } = await supabase
      .from('schedules')
      .select(SCHEDULE_SELECT_FIELDS)
      .eq('employee_id', employeeId)
      .lte('effective_from', effectiveDate)
      .order('effective_from', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle<ScheduleRow>();

    if (error) throw new Error(error.message);

    return normalizeScheduleRow(data ?? null);
  }

  private async getScheduleMapForEmployeesAsOf(
    employeeIds: string[],
    asOfDate: string,
  ): Promise<Map<string, ScheduleRow>> {
    if (employeeIds.length === 0) return new Map();
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('schedules')
      .select(SCHEDULE_SELECT_FIELDS)
      .in('employee_id', employeeIds)
      .lte('effective_from', asOfDate)
      .order('employee_id', { ascending: true })
      .order('effective_from', { ascending: false })
      .order('updated_at', { ascending: false });

    if (error) throw new Error(error.message);

    const map = new Map<string, ScheduleRow>();
    for (const row of (data ?? []) as ScheduleRow[]) {
      if (!row.employee_id || map.has(row.employee_id)) continue;
      const normalized = normalizeScheduleRow(row);
      if (normalized) map.set(row.employee_id, normalized);
    }
    return map;
  }

  private async getScheduleForToday(employeeId: string): Promise<ScheduleRow | null> {
    const manilaDate = this.getManilaDateString();
    const schedule = await this.getScheduleForEmployee(employeeId, manilaDate);
    if (!schedule) return null;
    if (!this.isScheduledForDate(schedule.workdays, manilaDate)) return null;
    return schedule;
  }

  private async getLatestLogForToday(
    employeeId: string,
  ): Promise<TimeLogRow | null> {
    const supabase = this.supabaseService.getClient();
    const { start, end } = todayRange();

    const { data, error } = await supabase
      .from('attendance_time_logs')
      .select(
        'log_id, employee_id, schedule_id, log_type, timestamp, latitude, longitude, ip_address, is_mock_location, clock_type, status, log_status',
      )
      .eq('employee_id', employeeId)
      .gte('timestamp', start)
      .lte('timestamp', end)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle<TimeLogRow>();

    if (error) {
      this.logger.error(
        `DB error while reading latest log for employee ${employeeId}`,
        error,
      );
      throw new Error(error.message);
    }

    return data ?? null;
  }

  async timeIn(userId: string, dto: TimePunchDto, req?: any) {
    const supabase = this.supabaseService.getClient();
    const { date: today } = todayRange();

    const employeeId = await this.getEmployeeId(userId);
    if (!employeeId) {
      throw new BadRequestException(
        'Employee profile not found. Cannot record time-in.',
      );
    }

    const [schedule, existing] = await Promise.all([
      this.getScheduleForToday(employeeId),
      this.getLatestLogForToday(employeeId),
    ]);

    if (!schedule) {
      throw new ForbiddenException(
        'No schedule has been assigned to you. Contact HR to set up your work schedule.',
      );
    }

    if (existing?.log_type === 'absence') {
      throw new BadRequestException(
        'You have reported an absence for today. Clock-in is not allowed.',
      );
    }

    if (existing?.log_type === 'time-in') {
      throw new BadRequestException(
        'You have already timed in today. Please time out before timing in again.',
      );
    }

    if (existing?.log_type === 'time-out') {
      throw new BadRequestException(
        'You have already completed your attendance for today. Multiple shifts per day are not allowed.',
      );
    }

    const nowDate = new Date();
    const now = nowDate.toISOString();
    const log_id = crypto.randomUUID();
    const clockType = schedule ? this.computeClockTypeForTimeIn(nowDate, schedule) : null;

    const { error: insertError } = await supabase
      .from('attendance_time_logs')
      .insert({
        log_id,
        employee_id: employeeId,
        schedule_id: schedule?.sched_id ?? null,
        log_type: 'time-in',
        timestamp: now,
        latitude: dto.latitude,
        longitude: dto.longitude,
        ip_address: getIp(req),
        is_mock_location: false,
        clock_type: clockType,
        status: 'PRESENT',
        log_status: 'PENDING',
      });

    if (insertError) {
      this.logger.error(
        `Failed to insert time-in for employee: ${employeeId}`,
        insertError,
      );
      throw new Error(insertError.message);
    }

    this.logger.log(`time-in recorded — employee: ${employeeId} at ${now}`);

    return {
      log_id,
      employee_id: employeeId,
      schedule_id: schedule?.sched_id ?? null,
      log_type: 'time-in',
      clock_type: clockType,
      status: 'PRESENT',
      log_status: 'PENDING',
      timestamp: now,
      latitude: dto.latitude,
      longitude: dto.longitude,
      date: today,
    };
  }

  async timeOut(userId: string, dto: TimePunchDto, req?: any) {
    const supabase = this.supabaseService.getClient();
    const { date: today } = todayRange();

    const employeeId = await this.getEmployeeId(userId);
    if (!employeeId) {
      throw new BadRequestException(
        'Employee profile not found. Cannot record time-out.',
      );
    }

    const [schedule, lastPunch] = await Promise.all([
      this.getScheduleForToday(employeeId),
      this.getLatestLogForToday(employeeId),
    ]);

    if (!schedule) {
      throw new ForbiddenException(
        'No schedule has been assigned to you. Contact HR to set up your work schedule.',
      );
    }

    if (!lastPunch) {
      throw new BadRequestException(
        'You have not timed in today. Please time in first.',
      );
    }

    if (lastPunch.log_type === 'absence') {
      throw new BadRequestException(
        'You have reported an absence for today. Clock-out is not allowed.',
      );
    }

    if (lastPunch.log_type === 'time-out') {
      throw new BadRequestException(
        'You have already timed out. Please time in again before timing out.',
      );
    }

    const nowDate = new Date();
    const now = nowDate.toISOString();
    const log_id = crypto.randomUUID();
    const clockType = schedule ? this.computeClockTypeForTimeOut(nowDate, schedule) : null;

    const { error: insertError } = await supabase
      .from('attendance_time_logs')
      .insert({
        log_id,
        employee_id: employeeId,
        schedule_id: schedule?.sched_id ?? null,
        log_type: 'time-out',
        timestamp: now,
        latitude: dto.latitude,
        longitude: dto.longitude,
        ip_address: getIp(req),
        is_mock_location: false,
        clock_type: clockType,
        status: 'PRESENT',
        log_status: 'PENDING',
      });

    if (insertError) {
      this.logger.error(
        `Failed to insert time-out for employee: ${employeeId}`,
        insertError,
      );
      throw new Error(insertError.message);
    }

    this.logger.log(`time-out recorded — employee: ${employeeId} at ${now}`);

    return {
      log_id,
      employee_id: employeeId,
      schedule_id: schedule?.sched_id ?? null,
      log_type: 'time-out',
      clock_type: clockType,
      status: 'PRESENT',
      log_status: 'PENDING',
      timestamp: now,
      latitude: dto.latitude,
      longitude: dto.longitude,
      date: today,
    };
  }

  async getMyStatus(userId: string) {
    const supabase = this.supabaseService.getClient();
    const { start, end, date: today } = todayRange();

    const employeeId = await this.getEmployeeId(userId);
    if (!employeeId) {
      return {
        date: today,
        current_status: null,
        time_in: null,
        time_out: null,
        schedule: null,
      };
    }

    const schedule = await this.getScheduleForEmployee(
      employeeId,
      this.getManilaDateString(),
    ).catch(() => null);

    const { data, error } = await supabase
      .from('attendance_time_logs')
      .select(
        'log_id, schedule_id, log_type, timestamp, latitude, longitude, ip_address, clock_type, status, log_status',
      )
      .eq('employee_id', employeeId)
      .gte('timestamp', start)
      .lte('timestamp', end)
      .order('timestamp', { ascending: true });

    if (error) throw new Error(error.message);

    const logs = data ?? [];
    const lastPunch = logs.at(-1);

    return {
      date: today,
      current_status: lastPunch?.log_type ?? null,
      time_in: logs.find((l) => l.log_type === 'time-in') ?? null,
      time_out: logs.find((l) => l.log_type === 'time-out') ?? null,
      schedule: schedule
        ? {
            sched_id: schedule.sched_id,
            workdays: schedule.workdays,
            start_time: schedule.start_time,
            end_time: schedule.end_time,
            is_nightshift: schedule.is_nightshift,
          }
        : null,
    };
  }

  async getMyTimesheet(userId: string, from?: string, to?: string) {
    const supabase = this.supabaseService.getClient();

    const employeeId = await this.getEmployeeId(userId);
    if (!employeeId) return [];

    let query = supabase
      .from('attendance_time_logs')
      .select(
        'log_id, schedule_id, log_type, timestamp, latitude, longitude, ip_address, clock_type, status, log_status, absence_reason, absence_notes',
      )
      .eq('employee_id', employeeId)
      .order('timestamp', { ascending: false });

    if (from) query = query.gte('timestamp', `${from}T00:00:00.000Z`);
    if (to) query = query.lte('timestamp', `${to}T23:59:59.999Z`);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return this.groupByDate(data ?? []);
  }

  async getEmployeeUsers(companyId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: roles } = await supabase
      .from('role')
      .select('role_id')
      .eq('role_name', 'Employee')
      .eq('company_id', companyId);

    const roleIds = (roles ?? []).map((r) => r.role_id);
    if (!roleIds.length) return [];

    const { data, error } = await supabase
      .from('user_profile')
      .select(
        'user_id, employee_id, first_name, last_name, avatar_url, department_id, department:department_id(department_name)',
      )
      .eq('company_id', companyId)
      .eq('account_status', 'Active')
      .not('employee_id', 'is', null)
      .in('role_id', roleIds);

    if (error) throw new Error(error.message);
    return ((data ?? []) as EmployeeUserRow[]).map(normalizeEmployeeUserRow);
  }

  async getAllTimesheets(companyId: string, from?: string, to?: string) {
    const supabase = this.supabaseService.getClient();
    const employees = await this.getEmployeeUsers(companyId);

    const employeeIds = employees.map((row) => row.employee_id).filter(Boolean);

    if (employeeIds.length === 0) return [];

    let query = supabase
      .from('attendance_time_logs')
      .select(`
        log_id,
        employee_id,
        schedule_id,
        log_type,
        timestamp,
        latitude,
        longitude,
        ip_address,
        is_mock_location,
        clock_type,
        status,
        log_status,
        absence_reason,
        absence_notes
      `)
      .in('employee_id', employeeIds)
      .order('timestamp', { ascending: false });

    if (from) query = query.gte('timestamp', `${from}T00:00:00.000Z`);
    if (to) query = query.lte('timestamp', `${to}T23:59:59.999Z`);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return data ?? [];
  }

  async getEmployeeDetail(
    targetUserId: string,
    date: string,
    companyId: string,
  ) {
    const supabase = this.supabaseService.getClient();

    const { data: targetUser, error: userError } = await supabase
      .from('user_profile')
      .select('user_id, first_name, last_name, employee_id, company_id')
      .eq('user_id', targetUserId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (userError) throw new Error(userError.message);
    if (!targetUser)
      throw new NotFoundException('Employee not found in your company');
    if (!targetUser.employee_id)
      throw new NotFoundException('Employee ID not assigned yet');

    const schedule = await this.getScheduleForEmployee(
      targetUser.employee_id,
      date,
    ).catch(() => null);

    const { data: logs, error: logsError } = await supabase
      .from('attendance_time_logs')
      .select(`
        log_id,
        employee_id,
        schedule_id,
        log_type,
        timestamp,
        latitude,
        longitude,
        ip_address,
        is_mock_location,
        clock_type,
        status,
        log_status
      `)
      .eq('employee_id', targetUser.employee_id)
      .gte('timestamp', `${date}T00:00:00.000Z`)
      .lte('timestamp', `${date}T23:59:59.999Z`)
      .order('timestamp', { ascending: true });

    if (logsError) throw new Error(logsError.message);

    return {
      user_id: targetUser.user_id,
      employee_id: targetUser.employee_id,
      first_name: targetUser.first_name,
      last_name: targetUser.last_name,
      date,
      schedule: schedule
        ? {
            sched_id: schedule.sched_id,
            workdays: schedule.workdays,
            start_time: schedule.start_time,
            end_time: schedule.end_time,
            break_start: schedule.break_start,
            break_end: schedule.break_end,
            is_nightshift: schedule.is_nightshift,
          }
        : null,
      punches: logs ?? [],
    };
  }

  async reportAbsence(userId: string, dto: ReportAbsenceDto) {
    const supabase = this.supabaseService.getClient();
    const { date: today, start, end } = todayRange();

    const employeeId = await this.getEmployeeId(userId);
    if (!employeeId) {
      throw new BadRequestException('Employee profile not found. Cannot report absence.');
    }

    const { data: existing } = await supabase
      .from('attendance_time_logs')
      .select('log_id, log_type')
      .eq('employee_id', employeeId)
      .gte('timestamp', start)
      .lte('timestamp', end)
      .limit(1)
      .maybeSingle();

    if (existing?.log_type === 'time-in' || existing?.log_type === 'time-out') {
      throw new BadRequestException('Cannot report absence after clocking in.');
    }
    if (existing?.log_type === 'absence') {
      throw new BadRequestException('Absence already reported for today.');
    }

    const log_id = crypto.randomUUID();
    const now = new Date().toISOString();

    const { error } = await supabase.from('attendance_time_logs').insert({
      log_id,
      employee_id: employeeId,
      log_type: 'absence',
      timestamp: now,
      absence_reason: dto.reason,
      absence_notes: dto.notes ?? null,
      status: 'ABSENT',
      log_status: 'PENDING',
      is_mock_location: false,
    });

    if (error) throw new Error(error.message);

    this.logger.log(`Absence reported — employee: ${employeeId}, reason: ${dto.reason}`);
    return { log_id, date: today, reason: dto.reason, notes: dto.notes ?? null };
  }

  // ─── Auto-Absent Job ──────────────────────────────────────────────────────

  /**
   * Auto-marks employees as absent if they have a schedule for today but
   * have no clock-in and did not self-report an absence.
   *
   * Intended to run at 11:30 PM Manila time via @Cron or a manual trigger.
   * Safe to call multiple times — duplicate absences are skipped.
   */
  async autoMarkAbsentEmployees(): Promise<{ date: string; marked: number; skipped: number }> {
    const supabase = this.supabaseService.getClient();

    // Use Manila timezone for the workday date
    const manilaDate = this.getManilaDateString(); // YYYY-MM-DD
    const manilaStart = `${manilaDate}T00:00:00.000+08:00`;
    const manilaEnd   = `${manilaDate}T23:59:59.999+08:00`;

    this.logger.log(`autoMarkAbsent: running for ${manilaDate}`);

    // 1. Fetch all active employees
    const { data: employees, error: empError } = await supabase
      .from('user_profile')
      .select('employee_id')
      .eq('account_status', 'Active')
      .not('employee_id', 'is', null);

    if (empError) {
      this.logger.error('autoMarkAbsent: failed to fetch employees', empError.message);
      return { date: manilaDate, marked: 0, skipped: 0 };
    }

    const employeeIds = ((employees ?? []) as { employee_id: string }[])
      .map(e => e.employee_id)
      .filter(Boolean);

    if (!employeeIds.length) {
      this.logger.log('autoMarkAbsent: no active employees found');
      return { date: manilaDate, marked: 0, skipped: 0 };
    }

    // 2. Resolve active schedules for this date
    const scheduleMap = await this.getScheduleMapForEmployeesAsOf(
      employeeIds,
      manilaDate,
    );

    // 3. Filter to employees scheduled for today's weekday
    const scheduledToday = employeeIds.filter(eid => {
      const workdays = scheduleMap.get(eid)?.workdays;
      return !!workdays && this.isScheduledForDate(workdays, manilaDate);
    });

    if (!scheduledToday.length) {
      this.logger.log('autoMarkAbsent: no employees scheduled today');
      return { date: manilaDate, marked: 0, skipped: 0 };
    }

    // 4. Fetch any existing attendance log today for scheduled employees
    const { data: todayLogs } = await supabase
      .from('attendance_time_logs')
      .select('employee_id')
      .in('employee_id', scheduledToday)
      .gte('timestamp', manilaStart)
      .lte('timestamp', manilaEnd);

    const hasLogToday = new Set(
      ((todayLogs ?? []) as { employee_id: string }[]).map(l => l.employee_id),
    );

    // 5. Mark absent those who have no log at all for today
    const toMark = scheduledToday.filter(eid => !hasLogToday.has(eid));

    if (!toMark.length) {
      this.logger.log(`autoMarkAbsent: all ${scheduledToday.length} scheduled employees already have logs`);
      return { date: manilaDate, marked: 0, skipped: scheduledToday.length };
    }

    const now = new Date().toISOString();
    const absenceRows = toMark.map(eid => ({
      log_id:          crypto.randomUUID(),
      employee_id:     eid,
      log_type:        'absence' as const,
      timestamp:       now,
      absence_reason:  null,   // no reason — auto-marked
      absence_notes:   'Automatically marked absent: no clock-in or absence report on scheduled workday.',
      status:          'ABSENT',
      log_status:      'ABSENT',
      is_mock_location: false,
    }));

    const { error: insertError } = await supabase
      .from('attendance_time_logs')
      .insert(absenceRows);

    if (insertError) {
      this.logger.error('autoMarkAbsent: insert failed', insertError.message);
      return { date: manilaDate, marked: 0, skipped: scheduledToday.length };
    }

    this.logger.log(
      `autoMarkAbsent: marked ${toMark.length} absent, skipped ${scheduledToday.length - toMark.length} (date: ${manilaDate})`,
    );
    return { date: manilaDate, marked: toMark.length, skipped: scheduledToday.length - toMark.length };
  }

  // ─── Schedule CRUD ────────────────────────────────────────────────────────

  async upsertEmployeeSchedule(
    targetUserId: string,
    dto: UpsertScheduleDto,
    companyId: string,
    updaterUserId: string,
  ): Promise<ScheduleRow> {
    const supabase = this.supabaseService.getClient();

    const [{ data: profile, error: profileError }, { data: updater }] = await Promise.all([
      supabase
        .from('user_profile')
        .select('employee_id, company_id')
        .eq('user_id', targetUserId)
        .maybeSingle(),
      supabase
        .from('user_profile')
        .select('first_name, last_name')
        .eq('user_id', updaterUserId)
        .maybeSingle(),
    ]);

    if (profileError) throw new Error(profileError.message);
    if (!profile) throw new NotFoundException('Employee not found.');
    if (profile.company_id !== companyId)
      throw new NotFoundException('Employee not found in your company.');
    if (!profile.employee_id)
      throw new BadRequestException('Employee does not have an employee_id assigned.');

    const updatedByName = updater
      ? `${updater.first_name ?? ''} ${updater.last_name ?? ''}`.trim() || null
      : null;
    const effectiveFrom = this.resolveEffectiveDate(dto.effective_date);

    const row = {
      employee_id: profile.employee_id,
      effective_from: effectiveFrom,
      start_time: dto.start_time,
      end_time: dto.end_time,
      break_start: dto.break_start ?? '00:00',
      break_end: dto.break_end ?? '00:00',
      workdays: dto.workdays,
      is_nightshift: dto.is_nightshift,
      schedule_source: 'individual' as const,
      updated_by_name: updatedByName,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('schedules')
      .upsert(row, { onConflict: 'employee_id,effective_from' })
      .select(SCHEDULE_SELECT_FIELDS)
      .single<ScheduleRow>();

    if (error) throw new Error(error.message);

    this.logger.log(`Schedule upserted — employee_id: ${profile.employee_id}, by: ${updatedByName}`);
    return normalizeScheduleRow(data)!;
  }

  async resetEmployeeScheduleToDepartment(
    targetUserId: string,
    dto: ScheduleEffectiveDateDto,
    companyId: string,
    updaterUserId: string,
  ): Promise<ScheduleRow> {
    const supabase = this.supabaseService.getClient();
    const effectiveFrom = this.resolveEffectiveDate(dto.effective_date);

    const [{ data: profile, error: profileError }, { data: updater }] =
      await Promise.all([
        supabase
          .from('user_profile')
          .select('employee_id, company_id, department_id')
          .eq('user_id', targetUserId)
          .maybeSingle(),
        supabase
          .from('user_profile')
          .select('first_name, last_name')
          .eq('user_id', updaterUserId)
          .maybeSingle(),
      ]);

    if (profileError) throw new Error(profileError.message);
    if (!profile) throw new NotFoundException('Employee not found.');
    if (profile.company_id !== companyId) {
      throw new NotFoundException('Employee not found in your company.');
    }
    if (!profile.employee_id) {
      throw new BadRequestException(
        'Employee does not have an employee_id assigned.',
      );
    }
    if (!profile.department_id) {
      throw new BadRequestException('Employee is not assigned to any department.');
    }

    const { data: members, error: membersError } = await supabase
      .from('user_profile')
      .select('employee_id')
      .eq('company_id', companyId)
      .eq('department_id', profile.department_id)
      .not('employee_id', 'is', null)
      .limit(500);

    if (membersError) throw new Error(membersError.message);

    const memberEmployeeIds = (members ?? [])
      .map((member: { employee_id?: string | null }) => member.employee_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    if (memberEmployeeIds.length === 0) {
      throw new BadRequestException(
        'No reusable department schedule found for this employee.',
      );
    }

    const { data: departmentSchedule, error: departmentScheduleError } =
      await supabase
        .from('schedules')
        .select(
          'start_time, end_time, break_start, break_end, workdays, is_nightshift, effective_from, updated_at',
        )
        .in('employee_id', memberEmployeeIds)
        .neq('schedule_source', 'individual')
        .lte('effective_from', effectiveFrom)
        .order('effective_from', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (departmentScheduleError) throw new Error(departmentScheduleError.message);
    if (!departmentSchedule) {
      throw new BadRequestException(
        'No department schedule is available on or before the selected effectivity date.',
      );
    }

    const updatedByName = updater
      ? `${updater.first_name ?? ''} ${updater.last_name ?? ''}`.trim() || null
      : null;
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('schedules')
      .upsert(
        {
          employee_id: profile.employee_id,
          effective_from: effectiveFrom,
          start_time: departmentSchedule.start_time,
          end_time: departmentSchedule.end_time,
          break_start: departmentSchedule.break_start ?? '00:00',
          break_end: departmentSchedule.break_end ?? '00:00',
          workdays: departmentSchedule.workdays,
          is_nightshift: departmentSchedule.is_nightshift ?? false,
          schedule_source: 'bulk',
          updated_by_name: updatedByName,
          updated_at: now,
        },
        { onConflict: 'employee_id,effective_from' },
      )
      .select(SCHEDULE_SELECT_FIELDS)
      .single<ScheduleRow>();

    if (error) throw new Error(error.message);

    this.logger.log(
      `Schedule reset to department baseline - employee_id: ${profile.employee_id}, effective_from: ${effectiveFrom}, by: ${updatedByName}`,
    );
    return normalizeScheduleRow(data)!;
  }

  async bulkAssignSchedule(
    dto: BulkScheduleDto,
    companyId: string,
    updaterUserId: string,
  ): Promise<{ affected: number }> {
    const supabase = this.supabaseService.getClient();

    if (dto.scope === 'department') {
      if (!dto.department_id) {
        throw new BadRequestException('department_id is required when scope is "department".');
      }
      const { data: dept } = await supabase
        .from('department')
        .select('company_id')
        .eq('department_id', dto.department_id)
        .maybeSingle();
      if (!dept || dept.company_id !== companyId) {
        throw new BadRequestException('Department not found in your company.');
      }
    }

    if (dto.scope === 'employees') {
      const hasUserIds = Array.isArray(dto.user_ids) && dto.user_ids.length > 0;
      const hasEmployeeIds =
        Array.isArray(dto.employee_ids) && dto.employee_ids.length > 0;
      if (!hasUserIds && !hasEmployeeIds) {
        throw new BadRequestException(
          'user_ids or employee_ids is required when scope is "employees".',
        );
      }
    }

    const [employees, { data: updater }] = await Promise.all([
      this.getEmployeeUsers(companyId),
      supabase
        .from('user_profile')
        .select('first_name, last_name')
        .eq('user_id', updaterUserId)
        .maybeSingle(),
    ]);

    const updatedByName = updater
      ? `${updater.first_name ?? ''} ${updater.last_name ?? ''}`.trim() || null
      : null;
    const effectiveFrom = this.resolveEffectiveDate(dto.effective_date);

    let filtered = employees;
    if (dto.scope === 'department' && dto.department_id) {
      filtered = employees.filter(e => e.department_id === dto.department_id);
    } else if (dto.scope === 'employees') {
      const userIdSet = new Set(
        (dto.user_ids ?? []).map((id) => String(id).trim()).filter(Boolean),
      );
      const employeeIdSet = new Set(
        (dto.employee_ids ?? [])
          .map((id) => String(id).trim())
          .filter(Boolean),
      );
      filtered = employees.filter(
        (e) => userIdSet.has(e.user_id) || employeeIdSet.has(e.employee_id),
      );
    }

    if (filtered.length === 0) return { affected: 0 };

    // Skip employees with individually-assigned schedules if requested
    if (dto.skip_individual) {
      const candidateEmpIds = filtered
        .map((e) => e.employee_id)
        .filter(Boolean) as string[];
      if (candidateEmpIds.length > 0) {
        const activeScheduleMap = await this.getScheduleMapForEmployeesAsOf(
          candidateEmpIds,
          effectiveFrom,
        );
        const individualSet = new Set(
          Array.from(activeScheduleMap.entries())
            .filter(([, schedule]) => schedule.schedule_source === 'individual')
            .map(([employeeId]) => employeeId),
        );
        filtered = filtered.filter(e => !individualSet.has(e.employee_id));
      }
    }

    if (filtered.length === 0) return { affected: 0 };

    const now = new Date().toISOString();
    const rows = filtered
      .filter(e => !!e.employee_id)
      .map(e => ({
        employee_id: e.employee_id,
        effective_from: effectiveFrom,
        start_time: dto.schedule.start_time,
        end_time: dto.schedule.end_time,
        break_start: dto.schedule.break_start ?? '00:00',
        break_end: dto.schedule.break_end ?? '00:00',
        workdays: dto.schedule.workdays,
        is_nightshift: dto.schedule.is_nightshift,
        // Keep DB-safe source value for all bulk writes (company/department scopes).
        schedule_source: 'bulk' as const,
        updated_by_name: updatedByName,
        updated_at: now,
      }));

    const { error } = await supabase
      .from('schedules')
      .upsert(rows, { onConflict: 'employee_id,effective_from' });

    if (error) throw new Error(error.message);

    this.logger.log(`Bulk schedule assigned — ${rows.length} employees, scope: ${dto.scope}, by: ${updatedByName}`);
    return { affected: rows.length };
  }

  async getEmployeeSchedule(
    targetUserId: string,
    companyId: string,
  ): Promise<ScheduleRow | null> {
    const supabase = this.supabaseService.getClient();

    const { data: profile, error } = await supabase
      .from('user_profile')
      .select('employee_id, company_id')
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!profile || profile.company_id !== companyId) return null;
    if (!profile.employee_id) return null;

    return this.getScheduleForEmployee(profile.employee_id, this.getManilaDateString());
  }

  async getAllSchedules(companyId: string): Promise<
    {
      user_id: string;
      employee_id: string;
      first_name: string;
      last_name: string;
      avatar_url: string | null;
      department_id: string | null;
      department_name: string | null;
      schedule: ScheduleRow | null;
    }[]
  > {
    const supabase = this.supabaseService.getClient();
    const employees = await this.getEmployeeUsers(companyId);

    const employeeIds = employees.map(e => e.employee_id).filter(Boolean);
    if (employeeIds.length === 0) return [];

    const scheduleMap = await this.getScheduleMapForEmployeesAsOf(
      employeeIds,
      this.getManilaDateString(),
    );

    return employees.map(e => ({
      user_id: e.user_id,
      employee_id: e.employee_id,
      first_name: e.first_name,
      last_name: e.last_name,
      avatar_url: e.avatar_url ?? null,
      department_id: e.department_id ?? null,
      department_name: normalizeDepartmentName(
        (e as EmployeeUserRow).department_name,
      ),
      schedule: scheduleMap.get(e.employee_id) ?? null,
    }));
  }

  async getMySchedule(userId: string): Promise<ScheduleRow | null> {
    const employeeId = await this.getEmployeeId(userId);
    if (!employeeId) return null;
    return this.getScheduleForEmployee(employeeId, this.getManilaDateString());
  }

  async getMyStats(
    userId: string,
    from: string,
    to: string,
  ): Promise<{
    attendance_rate: number;
    days_present: number;
    days_late: number;
    days_absent: number;
    hours_worked: number;
  }> {
    const entries = await this.getMyTimesheet(userId, from, to);

    let days_present = 0;
    let days_late = 0;
    let days_absent = 0;
    let hours_ms = 0;

    for (const entry of entries) {
      if (entry.absence) {
        days_absent++;
      } else if (entry.time_in) {
        days_present++;
        if (entry.time_in.clock_type === 'LATE') days_late++;
        if (entry.time_in && entry.time_out) {
          const diff =
            new Date(entry.time_out.timestamp).getTime() -
            new Date(entry.time_in.timestamp).getTime();
          if (diff > 0) hours_ms += diff;
        }
      }
    }

    const total = days_present + days_absent;
    const attendance_rate = total > 0 ? Math.round((days_present / total) * 100) : 0;
    const hours_worked = Math.round((hours_ms / 3_600_000) * 100) / 100;

    return { attendance_rate, days_present, days_late, days_absent, hours_worked };
  }

  private groupByDate(logs: any[]) {
    const grouped: Record<
      string,
      {
        date: string;
        time_in: any;
        time_out: any;
        absence: any;
        all_logs: any[];
      }
    > = {};

    for (const log of logs) {
      const logDate = log.timestamp.split('T')[0];

      if (!grouped[logDate]) {
        grouped[logDate] = {
          date: logDate,
          time_in: null,
          time_out: null,
          absence: null,
          all_logs: [],
        };
      }

      grouped[logDate].all_logs.push(log);

      if (log.log_type === 'time-in' && !grouped[logDate].time_in) {
        grouped[logDate].time_in = log;
      }
      if (log.log_type === 'time-out') {
        grouped[logDate].time_out = log;
      }
      if (log.log_type === 'absence') {
        grouped[logDate].absence = log;
      }
    }

    return Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));
  }
}
