import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { MailService } from '../mail/mail.service';
import { TimePunchDto } from './dto/time-punch.dto';
import { ReportAbsenceDto } from './dto/report-absence.dto';
import { UpsertScheduleDto } from './dto/upsert-schedule.dto';
import { BulkScheduleDto } from './dto/bulk-schedule.dto';
import { ScheduleEffectiveDateDto } from './dto/schedule-effective-date.dto';
import {
  ReviewAbsenceDto,
  AbsenceReviewAction,
} from './dto/review-absence.dto';
import { EditAttendanceDto } from './dto/edit-attendance.dto';

type AttendanceLogType = 'time-in' | 'time-out' | 'break-start' | 'break-end' | 'absence';
type ClockType =
  | 'ON-TIME'
  | 'LATE'
  | 'EARLY'
  | 'OVERTIME'
  | 'ABSENT_NO_CLOCKIN'
  | 'NO_CLOCKOUT';

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
  location_name?: string | null;
  absence_reason?: string | null;
  absence_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_reason?: string | null;
  edited_by?: string | null;
  edited_at?: string | null;
  edit_reason?: string | null;
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
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
  }).format(new Date());

  return {
    start: `${date}T00:00:00.000+08:00`,
    end: `${date}T23:59:59.999+08:00`,
    date,
  };
}

const SCHEDULE_SELECT_FIELDS =
  'sched_id, employee_id, effective_from, workdays, start_time, end_time, break_start, break_end, is_nightshift, schedule_source, updated_by_name, updated_at';

const DEFAULT_GEOCODE_ENDPOINT = 'https://nominatim.openstreetmap.org/reverse';
const DEFAULT_GEOCODE_TIMEOUT_MS = 2000;
const DEFAULT_GEOCODE_PRECISION = 4;

function clampInteger(
  rawValue: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number.parseInt(rawValue ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

@Injectable()
export class TimekeepingService {
  private readonly logger = new Logger(TimekeepingService.name);
  private readonly geocodeEndpoint =
    process.env.TIMEKEEPING_GEOCODE_ENDPOINT?.trim() || DEFAULT_GEOCODE_ENDPOINT;
  private readonly geocodeEnabled =
    (process.env.TIMEKEEPING_REVERSE_GEOCODE ?? 'true').toLowerCase() !== 'false';
  private readonly geocodeTimeoutMs = clampInteger(
    process.env.TIMEKEEPING_GEOCODE_TIMEOUT_MS,
    DEFAULT_GEOCODE_TIMEOUT_MS,
    250,
    15000,
  );
  private readonly geocodePrecision = clampInteger(
    process.env.TIMEKEEPING_GEOCODE_PRECISION,
    DEFAULT_GEOCODE_PRECISION,
    2,
    6,
  );
  private readonly geocodeCache = new Map<string, string | null>();
  private readonly geocodeInFlight = new Map<string, Promise<string | null>>();

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly mailService: MailService,
  ) {}

  private toCoordinateKey(latitude: number, longitude: number): string {
    return `${latitude.toFixed(this.geocodePrecision)},${longitude.toFixed(this.geocodePrecision)}`;
  }

  private async fetchLocationName(
    latitude: number,
    longitude: number,
  ): Promise<string | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.geocodeTimeoutMs);

    try {
      const url = new URL(this.geocodeEndpoint);
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('lat', String(latitude));
      url.searchParams.set('lon', String(longitude));
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('zoom', '17');

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'BlueTribe-HRIS/1.0',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status !== 404 && response.status !== 429) {
          this.logger.warn(
            `Reverse geocode failed (${response.status}) for ${latitude},${longitude}`,
          );
        }
        return null;
      }

      const payload = (await response.json()) as {
        display_name?: unknown;
        name?: unknown;
      };

      if (typeof payload.display_name === 'string') {
        const displayName = payload.display_name.trim();
        if (displayName.length > 0) return displayName;
      }

      if (typeof payload.name === 'string') {
        const name = payload.name.trim();
        if (name.length > 0) return name;
      }

      return null;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        this.logger.warn(
          `Reverse geocode timed out for ${latitude},${longitude}`,
        );
        return null;
      }
      this.logger.warn(
        `Reverse geocode error for ${latitude},${longitude}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async resolveLocationName(
    latitude: number | null | undefined,
    longitude: number | null | undefined,
  ): Promise<string | null> {
    if (!this.geocodeEnabled) return null;
    if (latitude == null || longitude == null) return null;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    const key = this.toCoordinateKey(latitude, longitude);

    if (this.geocodeCache.has(key)) {
      return this.geocodeCache.get(key) ?? null;
    }

    const inflight = this.geocodeInFlight.get(key);
    if (inflight) return inflight;

    const request = this.fetchLocationName(latitude, longitude)
      .then((locationName) => {
        this.geocodeCache.set(key, locationName);
        return locationName;
      })
      .finally(() => {
        this.geocodeInFlight.delete(key);
      });

    this.geocodeInFlight.set(key, request);
    return request;
  }

  private async withLocationNames<T extends { latitude: number | null; longitude: number | null }>(
    logs: T[],
  ): Promise<Array<T & { location_name: string | null }>> {
    if (logs.length === 0) return [];

    return Promise.all(
      logs.map(async (log) => ({
        ...log,
        location_name: await this.resolveLocationName(log.latitude, log.longitude),
      })),
    );
  }

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
      const manilaDate = this.getManilaDateString(baseDate);
      return new Date(
        `${manilaDate}T${String(Number(hh)).padStart(2, '0')}:${mm}:${String(
          Number(ss ?? 0),
        ).padStart(2, '0')}+08:00`,
      );
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

      const manilaDate = this.getManilaDateString(baseDate);
      return new Date(
        `${manilaDate}T${String(hour).padStart(2, '0')}:${mm}:${String(
          Number(ss ?? 0),
        ).padStart(2, '0')}+08:00`,
      );
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

  private ensureIsoDate(date: string): string {
    const normalized = String(date ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      throw new BadRequestException('date must be in YYYY-MM-DD format.');
    }
    return normalized;
  }

  private enumerateDateRange(from: string, to: string): string[] {
    const start = this.ensureIsoDate(from);
    const end = this.ensureIsoDate(to);
    if (end < start) {
      throw new BadRequestException('date_to cannot be earlier than date_from.');
    }

    const dates: string[] = [];
    const cursor = new Date(`${start}T00:00:00+08:00`);
    const last = new Date(`${end}T00:00:00+08:00`);

    while (cursor <= last) {
      dates.push(this.getManilaDateString(cursor));
      if (dates.length > 31) {
        throw new BadRequestException('Absence range cannot exceed 31 days.');
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return dates;
  }

  private toManilaTimestamp(date: string, timeHHMM: string): string {
    return `${date}T${timeHHMM}:00+08:00`;
  }

  private async createSystemAbsentLog(
    employeeId: string,
    absenceNote: string,
    timestamp?: string,
  ): Promise<string> {
    const supabase = this.supabaseService.getClient();
    const ts = timestamp ?? new Date().toISOString();
    const dateForRange = this.getManilaDateString(new Date(ts));
    const dayStart = `${dateForRange}T00:00:00.000+08:00`;
    const dayEnd = `${dateForRange}T23:59:59.999+08:00`;

    const { data: existing, error: existingError } = await supabase
      .from('attendance_time_logs')
      .select('log_id')
      .eq('employee_id', employeeId)
      .eq('log_type', 'absence')
      .gte('timestamp', dayStart)
      .lte('timestamp', dayEnd)
      .order('timestamp', { ascending: true })
      .limit(1)
      .maybeSingle<{ log_id: string }>();

    if (existingError) throw new Error(existingError.message);
    if (existing?.log_id) return existing.log_id;

    const logId = crypto.randomUUID();

    const { error } = await supabase.from('attendance_time_logs').insert({
      log_id: logId,
      employee_id: employeeId,
      log_type: 'absence',
      timestamp: ts,
      absence_reason: null,
      absence_notes: absenceNote,
      status: 'ABSENT',
      log_status: 'ABSENT',
      clock_type: 'ABSENT_NO_CLOCKIN',
      is_mock_location: false,
    });

    if (error) throw new Error(error.message);
    return logId;
  }

  private async insertAttendanceAudit(params: {
    employee_id: string;
    target_user_id: string;
    date: string;
    edited_by: string;
    edit_reason: string;
    before_payload: unknown;
    after_payload: unknown;
  }): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.from('attendance_time_log_audits').insert({
      audit_id: crypto.randomUUID(),
      employee_id: params.employee_id,
      target_user_id: params.target_user_id,
      date: params.date,
      edited_by: params.edited_by,
      edited_at: new Date().toISOString(),
      edit_reason: params.edit_reason,
      before_payload: params.before_payload,
      after_payload: params.after_payload,
    });

    if (error) throw new Error(error.message);
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
      .order('timestamp', { ascending: false });

    if (error) {
      this.logger.error(
        `DB error while reading latest log for employee ${employeeId}`,
        error,
      );
      throw new Error(error.message);
    }

    const logs = (data ?? []) as TimeLogRow[];
    return (
      logs.find(
        (log) =>
          log.log_type !== 'absence' ||
          String(log.log_status ?? '').toUpperCase() !== 'DENIED',
      ) ?? null
    );
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

    if (
      existing?.log_type === 'absence' &&
      String(existing.log_status ?? '').toUpperCase() !== 'DENIED'
    ) {
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
    const { shiftEnd } = this.buildScheduleWindow(schedule, nowDate);

    if (nowDate.getTime() > shiftEnd.getTime()) {
      await this.createSystemAbsentLog(
        employeeId,
        'Automatically marked absent: attempted clock-in after scheduled shift end.',
      );
      throw new BadRequestException(
        'Clock-in is no longer allowed after your scheduled end time. You were marked absent for today.',
      );
    }

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

    const locationName = await this.resolveLocationName(
      dto.latitude ?? null,
      dto.longitude ?? null,
    );

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
      location_name: locationName,
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

    const locationName = await this.resolveLocationName(
      dto.latitude ?? null,
      dto.longitude ?? null,
    );

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
      location_name: locationName,
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
        'log_id, schedule_id, log_type, timestamp, latitude, longitude, ip_address, clock_type, status, log_status, absence_reason, absence_notes, reviewed_by, reviewed_at, review_reason, edited_by, edited_at, edit_reason',
      )
      .eq('employee_id', employeeId)
      .gte('timestamp', start)
      .lte('timestamp', end)
      .order('timestamp', { ascending: true });

    if (error) throw new Error(error.message);

    const logs = await this.withLocationNames((data ?? []) as TimeLogRow[]);
    const activeLogs = logs.filter(
      (log) =>
        log.log_type !== 'absence' ||
        String(log.log_status ?? '').toUpperCase() !== 'DENIED',
    );
    const lastPunch = activeLogs.at(-1);

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
        'log_id, schedule_id, log_type, timestamp, latitude, longitude, ip_address, clock_type, status, log_status, absence_reason, absence_notes, reviewed_by, reviewed_at, review_reason, edited_by, edited_at, edit_reason',
      )
      .eq('employee_id', employeeId)
      .order('timestamp', { ascending: false });

    if (from) query = query.gte('timestamp', `${from}T00:00:00.000Z`);
    if (to) query = query.lte('timestamp', `${to}T23:59:59.999Z`);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const logsWithLocation = await this.withLocationNames(
      (data ?? []) as TimeLogRow[],
    );

    const entries = this.groupByDate(logsWithLocation);

    const reviewerIds = [
      ...new Set(
        entries
          .map((e: any) => e.absence?.reviewed_by)
          .filter((id: any): id is string => typeof id === 'string'),
      ),
    ];

    if (reviewerIds.length > 0) {
      const { data: reviewers } = await supabase
        .from('user_profile')
        .select('user_id, first_name, last_name')
        .in('user_id', reviewerIds);

      const nameMap = Object.fromEntries(
        (reviewers ?? []).map((r: any) => [
          r.user_id,
          `${r.first_name} ${r.last_name}`,
        ]),
      );

      for (const entry of entries as any[]) {
        if (entry.absence?.reviewed_by) {
          entry.absence.reviewed_by_name =
            nameMap[entry.absence.reviewed_by] ?? null;
        }
      }
    }

    return entries;
  }

  async getEmployeeUsers(companyId: string, asOfDate?: string) {
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

    const employees = ((data ?? []) as EmployeeUserRow[]).map(normalizeEmployeeUserRow);
    if (!asOfDate) return employees;

    const employeeIds = employees.map((row) => row.employee_id).filter(Boolean);
    const scheduleMap = await this.getScheduleMapForEmployeesAsOf(
      employeeIds,
      asOfDate,
    );

    return employees.map((employee) => ({
      ...employee,
      schedule: scheduleMap.get(employee.employee_id) ?? null,
    }));
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
        absence_notes,
        reviewed_by,
        reviewed_at,
        review_reason,
        edited_by,
        edited_at,
        edit_reason
      `)
      .in('employee_id', employeeIds)
      .order('timestamp', { ascending: false });

    if (from) query = query.gte('timestamp', `${from}T00:00:00.000Z`);
    if (to) query = query.lte('timestamp', `${to}T23:59:59.999Z`);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return this.withLocationNames((data ?? []) as TimeLogRow[]);
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
        log_status,
        absence_reason,
        absence_notes,
        reviewed_by,
        reviewed_at,
        review_reason,
        edited_by,
        edited_at,
        edit_reason
      `)
      .eq('employee_id', targetUser.employee_id)
      .gte('timestamp', `${date}T00:00:00.000Z`)
      .lte('timestamp', `${date}T23:59:59.999Z`)
      .order('timestamp', { ascending: true });

    if (logsError) throw new Error(logsError.message);

    const logsWithLocation = await this.withLocationNames(
      (logs ?? []) as TimeLogRow[],
    );

    const [{ data: audits, error: auditsError }] = await Promise.all([
      supabase
        .from('attendance_time_log_audits')
        .select(
          'audit_id, employee_id, target_user_id, date, edited_by, edited_at, edit_reason, before_payload, after_payload',
        )
        .eq('employee_id', targetUser.employee_id)
        .eq('date', date)
        .order('edited_at', { ascending: false }),
    ]);

    if (auditsError) throw new Error(auditsError.message);

    const reviewerIds = [
      ...new Set(
        logsWithLocation
          .map((l) => (l as any).reviewed_by)
          .filter((id: any): id is string => typeof id === 'string'),
      ),
    ];

    const nameMap: Record<string, string> = {};
    if (reviewerIds.length > 0) {
      const { data: reviewers } = await supabase
        .from('user_profile')
        .select('user_id, first_name, last_name')
        .in('user_id', reviewerIds);
      for (const r of reviewers ?? []) {
        nameMap[r.user_id] = `${r.first_name} ${r.last_name}`;
      }
    }

    const punchesWithReviewer = logsWithLocation.map((l) => ({
      ...(l as any),
      reviewed_by_name:
        (l as any).reviewed_by ? (nameMap[(l as any).reviewed_by] ?? null) : null,
    }));

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
      punches: punchesWithReviewer,
      attendance_audits: audits ?? [],
    };
  }

  async reportAbsence(userId: string, dto: ReportAbsenceDto, req?: any) {
    const supabase = this.supabaseService.getClient();
    const { date: today } = todayRange();

    const employeeId = await this.getEmployeeId(userId);
    if (!employeeId) {
      throw new BadRequestException('Employee profile not found. Cannot report absence.');
    }

    const dateFrom = dto.date_from ? this.ensureIsoDate(dto.date_from) : today;
    const dateTo = dto.date_to ? this.ensureIsoDate(dto.date_to) : dateFrom;
    const absenceDates = this.enumerateDateRange(dateFrom, dateTo);
    const rangeStart = `${absenceDates[0]}T00:00:00.000+08:00`;
    const rangeEnd = `${absenceDates.at(-1)}T23:59:59.999+08:00`;

    const { data: existingLogs, error: existingError } = await supabase
      .from('attendance_time_logs')
      .select('log_id, log_type, timestamp')
      .eq('employee_id', employeeId)
      .gte('timestamp', rangeStart)
      .lte('timestamp', rangeEnd);

    if (existingError) throw new Error(existingError.message);

    const existingByDate = new Map(
      (existingLogs ?? []).map((log) => [
        this.getManilaDateString(new Date(log.timestamp)),
        log.log_type,
      ]),
    );

    for (const date of absenceDates) {
      const existingType = existingByDate.get(date);
      if (existingType === 'time-in' || existingType === 'time-out') {
        throw new BadRequestException(
          `Cannot report absence for ${date} after clocking in.`,
        );
      }
      if (existingType === 'absence') {
        throw new BadRequestException(`Absence already reported for ${date}.`);
      }
    }

    const now = new Date().toISOString();
    const rows = absenceDates.map((date) => ({
      log_id: crypto.randomUUID(),
      employee_id: employeeId,
      log_type: 'absence' as const,
      timestamp: date === today ? now : `${date}T12:00:00+08:00`,
      latitude: dto.latitude,
      longitude: dto.longitude,
      ip_address: getIp(req),
      absence_reason: dto.reason,
      absence_notes: dto.notes ?? null,
      status: 'ABSENT',
      log_status: 'PENDING',
      is_mock_location: false,
    }));

    const { data: inserted, error } = await supabase
      .from('attendance_time_logs')
      .insert(rows)
      .select('log_id, timestamp');

    if (error) throw new Error(error.message);

    this.logger.log(`Absence reported — employee: ${employeeId}, reason: ${dto.reason}`);
    return {
      log_id: inserted?.[0]?.log_id ?? rows[0].log_id,
      log_ids: (inserted ?? rows).map((row) => row.log_id),
      date: absenceDates[0],
      date_from: absenceDates[0],
      date_to: absenceDates.at(-1),
      days: absenceDates.length,
      reason: dto.reason,
      notes: dto.notes ?? null,
      latitude: dto.latitude,
      longitude: dto.longitude,
    };
  }

  async getAbsenceRequests(companyId: string, status?: string) {
    const supabase = this.supabaseService.getClient();
    const employees = await this.getEmployeeUsers(companyId);
    const employeeIds = employees.map((e) => e.employee_id).filter(Boolean);
    if (employeeIds.length === 0) return [];

    const employeeById = new Map(employees.map((e) => [e.employee_id, e]));
    const normalizedStatus = status?.trim().toUpperCase();

    let query = supabase
      .from('attendance_time_logs')
      .select(`
        log_id,
        employee_id,
        log_type,
        timestamp,
        latitude,
        longitude,
        ip_address,
        status,
        log_status,
        absence_reason,
        absence_notes,
        reviewed_by,
        reviewed_at,
        review_reason
      `)
      .eq('log_type', 'absence')
      .in('employee_id', employeeIds)
      .order('timestamp', { ascending: false });

    if (normalizedStatus && normalizedStatus !== 'ALL') {
      query = query.eq('log_status', normalizedStatus);
    } else {
      query = query.eq('log_status', 'PENDING');
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const logsWithLocation = await this.withLocationNames(
      (data ?? []) as TimeLogRow[],
    );

    return logsWithLocation.map((log) => {
      const employee = employeeById.get(log.employee_id ?? '');
      return {
        log_id: log.log_id,
        employee_id: log.employee_id,
        user_id: employee?.user_id ?? null,
        first_name: employee?.first_name ?? null,
        last_name: employee?.last_name ?? null,
        department_id: employee?.department_id ?? null,
        department_name: employee?.department_name ?? null,
        timestamp: log.timestamp,
        latitude: log.latitude,
        longitude: log.longitude,
        location_name: log.location_name ?? null,
        absence_reason: log.absence_reason ?? null,
        absence_notes: log.absence_notes ?? null,
        log_status: log.log_status ?? 'PENDING',
        reviewed_by: log.reviewed_by ?? null,
        reviewed_at: log.reviewed_at ?? null,
        review_reason: log.review_reason ?? null,
      };
    });
  }

  async reviewAbsenceRequest(
    logId: string,
    dto: ReviewAbsenceDto,
    companyId: string,
    reviewerUserId: string,
  ) {
    const supabase = this.supabaseService.getClient();

    const { data: target, error: targetError } = await supabase
      .from('attendance_time_logs')
      .select('log_id, employee_id, log_type, log_status')
      .eq('log_id', logId)
      .maybeSingle();

    if (targetError) throw new Error(targetError.message);
    if (!target || target.log_type !== 'absence') {
      throw new NotFoundException('Absence request not found.');
    }

    const { data: owner, error: ownerError } = await supabase
      .from('user_profile')
      .select('user_id, company_id, first_name, last_name, email')
      .eq('employee_id', target.employee_id)
      .eq('company_id', companyId)
      .maybeSingle();

    if (ownerError) throw new Error(ownerError.message);
    if (!owner) throw new NotFoundException('Absence request not found in your company.');

    const nextStatus =
      dto.action === AbsenceReviewAction.APPROVE ? 'APPROVED' : 'DENIED';

    const [{ data: updated, error: updateError }, { data: reviewer }] = await Promise.all([
      supabase
        .from('attendance_time_logs')
        .update({
          log_status: nextStatus,
          reviewed_by: reviewerUserId,
          reviewed_at: new Date().toISOString(),
          review_reason: dto.review_reason,
        })
        .eq('log_id', logId)
        .eq('log_type', 'absence')
        .select(
          'log_id, employee_id, log_type, timestamp, latitude, longitude, absence_reason, absence_notes, log_status, reviewed_by, reviewed_at, review_reason',
        )
        .maybeSingle<TimeLogRow>(),
      supabase
        .from('user_profile')
        .select('user_id, first_name, last_name')
        .eq('user_id', reviewerUserId)
        .maybeSingle(),
    ]);

    if (updateError) throw new Error(updateError.message);
    if (!updated) throw new NotFoundException('Absence request not found.');

    const reviewerName = reviewer
      ? `${reviewer.first_name} ${reviewer.last_name}`
      : 'HR';

    if (owner.email) {
      const absenceDate = updated.timestamp.split('T')[0];
      this.mailService
        .sendAbsenceReviewEmail({
          to: owner.email,
          employeeName: `${owner.first_name} ${owner.last_name}`,
          reviewerName,
          action: nextStatus as 'APPROVED' | 'DENIED',
          absenceDate,
          absenceReason: updated.absence_reason ?? 'Absence',
          reviewNote: dto.review_reason,
        })
        .catch((err) =>
          this.logger.warn('Absence review email failed silently', err),
        );
    }

    const [withLocation] = await this.withLocationNames([updated]);
    return {
      ...withLocation,
      user_id: owner.user_id,
      reviewed_by_name: reviewerName,
    };
  }

  async editAttendanceForDate(
    targetUserId: string,
    date: string,
    dto: EditAttendanceDto,
    companyId: string,
    editorUserId: string,
  ) {
    const supabase = this.supabaseService.getClient();
    const safeDate = this.ensureIsoDate(date);

    if (!dto.time_in && !dto.time_out) {
      throw new BadRequestException('Provide at least one of time_in or time_out.');
    }

    const { data: targetUser, error: targetUserError } = await supabase
      .from('user_profile')
      .select('user_id, employee_id, first_name, last_name, company_id')
      .eq('user_id', targetUserId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (targetUserError) throw new Error(targetUserError.message);
    if (!targetUser || !targetUser.employee_id) {
      throw new NotFoundException('Employee not found in your company.');
    }

    const dayStart = `${safeDate}T00:00:00.000+08:00`;
    const dayEnd = `${safeDate}T23:59:59.999+08:00`;

    const { data: existingLogs, error: existingError } = await supabase
      .from('attendance_time_logs')
      .select(
        'log_id, employee_id, schedule_id, log_type, timestamp, latitude, longitude, ip_address, is_mock_location, clock_type, status, log_status, absence_reason, absence_notes, reviewed_by, reviewed_at, review_reason, edited_by, edited_at, edit_reason',
      )
      .eq('employee_id', targetUser.employee_id)
      .gte('timestamp', dayStart)
      .lte('timestamp', dayEnd)
      .order('timestamp', { ascending: true });

    if (existingError) throw new Error(existingError.message);

    const logs = (existingLogs ?? []) as TimeLogRow[];
    const existingTimeIn = logs.find((log) => log.log_type === 'time-in') ?? null;
    const existingTimeOut = logs.find((log) => log.log_type === 'time-out') ?? null;
    const existingAbsences = logs.filter((log) => log.log_type === 'absence');
    const beforePayload = logs;
    const nowIso = new Date().toISOString();

    const schedule = await this.getScheduleForEmployee(targetUser.employee_id, safeDate);

    const parsedTimeIn = dto.time_in ? this.toManilaTimestamp(safeDate, dto.time_in) : null;
    const parsedTimeOut = dto.time_out
      ? this.toManilaTimestamp(safeDate, dto.time_out)
      : null;

    if (parsedTimeIn && parsedTimeOut) {
      if (new Date(parsedTimeOut).getTime() <= new Date(parsedTimeIn).getTime()) {
        throw new BadRequestException('time_out must be later than time_in.');
      }
    }

    if (parsedTimeIn) {
      const clockType = schedule
        ? this.computeClockTypeForTimeIn(new Date(parsedTimeIn), schedule)
        : null;

      if (existingTimeIn) {
        const { error } = await supabase
          .from('attendance_time_logs')
          .update({
            timestamp: parsedTimeIn,
            schedule_id: schedule?.sched_id ?? null,
            clock_type: clockType,
            status: 'PRESENT',
            log_status: 'APPROVED',
            edited_by: editorUserId,
            edited_at: nowIso,
            edit_reason: dto.edit_reason,
          })
          .eq('log_id', existingTimeIn.log_id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from('attendance_time_logs').insert({
          log_id: crypto.randomUUID(),
          employee_id: targetUser.employee_id,
          schedule_id: schedule?.sched_id ?? null,
          log_type: 'time-in',
          timestamp: parsedTimeIn,
          status: 'PRESENT',
          log_status: 'APPROVED',
          clock_type: clockType,
          is_mock_location: false,
          edited_by: editorUserId,
          edited_at: nowIso,
          edit_reason: dto.edit_reason,
        });
        if (error) throw new Error(error.message);
      }
    }

    if (parsedTimeOut) {
      const clockType = schedule
        ? this.computeClockTypeForTimeOut(new Date(parsedTimeOut), schedule)
        : null;

      if (existingTimeOut) {
        const { error } = await supabase
          .from('attendance_time_logs')
          .update({
            timestamp: parsedTimeOut,
            schedule_id: schedule?.sched_id ?? null,
            clock_type: clockType,
            status: 'PRESENT',
            log_status: 'APPROVED',
            edited_by: editorUserId,
            edited_at: nowIso,
            edit_reason: dto.edit_reason,
          })
          .eq('log_id', existingTimeOut.log_id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from('attendance_time_logs').insert({
          log_id: crypto.randomUUID(),
          employee_id: targetUser.employee_id,
          schedule_id: schedule?.sched_id ?? null,
          log_type: 'time-out',
          timestamp: parsedTimeOut,
          status: 'PRESENT',
          log_status: 'APPROVED',
          clock_type: clockType,
          is_mock_location: false,
          edited_by: editorUserId,
          edited_at: nowIso,
          edit_reason: dto.edit_reason,
        });
        if (error) throw new Error(error.message);
      }
    }

    if (existingAbsences.length > 0 && (parsedTimeIn || parsedTimeOut)) {
      const absenceIds = existingAbsences.map((log) => log.log_id);
      const { error } = await supabase
        .from('attendance_time_logs')
        .update({
          log_status: 'DENIED',
          reviewed_by: editorUserId,
          reviewed_at: nowIso,
          review_reason: `Superseded by attendance correction: ${dto.edit_reason}`,
          edited_by: editorUserId,
          edited_at: nowIso,
          edit_reason: dto.edit_reason,
        })
        .in('log_id', absenceIds);
      if (error) throw new Error(error.message);
    }

    const { data: afterLogs, error: afterError } = await supabase
      .from('attendance_time_logs')
      .select(
        'log_id, employee_id, schedule_id, log_type, timestamp, latitude, longitude, ip_address, is_mock_location, clock_type, status, log_status, absence_reason, absence_notes, reviewed_by, reviewed_at, review_reason, edited_by, edited_at, edit_reason',
      )
      .eq('employee_id', targetUser.employee_id)
      .gte('timestamp', dayStart)
      .lte('timestamp', dayEnd)
      .order('timestamp', { ascending: true });

    if (afterError) throw new Error(afterError.message);

    await this.insertAttendanceAudit({
      employee_id: targetUser.employee_id,
      target_user_id: targetUserId,
      date: safeDate,
      edited_by: editorUserId,
      edit_reason: dto.edit_reason,
      before_payload: beforePayload,
      after_payload: afterLogs ?? [],
    });

    const withLocation = await this.withLocationNames((afterLogs ?? []) as TimeLogRow[]);

    return {
      user_id: targetUserId,
      employee_id: targetUser.employee_id,
      date: safeDate,
      punches: withLocation,
      message: 'Attendance updated successfully.',
    };
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
      .select('employee_id, log_type, log_status')
      .in('employee_id', scheduledToday)
      .gte('timestamp', manilaStart)
      .lte('timestamp', manilaEnd);

    const hasLogToday = new Set(
      ((todayLogs ?? []) as { employee_id: string; log_type?: string | null; log_status?: string | null }[])
        .filter((log) => {
          if (log.log_type !== 'absence') return true;
          return String(log.log_status ?? '').toUpperCase() !== 'DENIED';
        })
        .map(l => l.employee_id),
    );

    // 5. Mark absent those who have no log at all for today
    const toMark = scheduledToday.filter(eid => !hasLogToday.has(eid));

    if (!toMark.length) {
      this.logger.log(`autoMarkAbsent: all ${scheduledToday.length} scheduled employees already have logs`);
      return { date: manilaDate, marked: 0, skipped: scheduledToday.length };
    }

    const markTimestamp = `${manilaDate}T23:59:00.000+08:00`;
    const absenceRows = toMark.map(eid => ({
      log_id:          crypto.randomUUID(),
      employee_id:     eid,
      log_type:        'absence' as const,
      timestamp:       markTimestamp,
      absence_reason:  null,   // no reason — auto-marked
      absence_notes:   'Automatically marked absent: no clock-in or absence report on scheduled workday.',
      status:          'ABSENT',
      log_status:      'ABSENT',
      clock_type:      'ABSENT_NO_CLOCKIN',
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
        absence_request: any;
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
          absence_request: null,
          all_logs: [],
        };
      }

      grouped[logDate].all_logs.push(log);

      if (log.log_type === 'time-in' && !grouped[logDate].time_in) {
        grouped[logDate].time_in = log;
      }
      if (log.log_type === 'time-out' && !grouped[logDate].time_out) {
        grouped[logDate].time_out = log;
      }
      if (log.log_type === 'absence') {
        if (!grouped[logDate].absence_request) {
          grouped[logDate].absence_request = log;
        }
        if (
          String(log.log_status ?? '').toUpperCase() === 'DENIED' &&
          String(grouped[logDate].absence_request?.log_status ?? '').toUpperCase() !==
            'DENIED'
        ) {
          grouped[logDate].absence_request = log;
        }
        if (
          String(log.log_status ?? '').toUpperCase() !== 'DENIED' &&
          !grouped[logDate].absence
        ) {
          grouped[logDate].absence = log;
        }
      }
    }

    return Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));
  }
}
