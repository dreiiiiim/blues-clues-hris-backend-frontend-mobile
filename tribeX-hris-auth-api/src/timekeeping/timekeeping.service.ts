import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { TimePunchDto } from './dto/time-punch.dto';

type TimeLogRow = {
  log_id: string;
  user_id: string;
  company_id: string;
  employee_id: string | null;
  punch_type: 'TIME_IN' | 'TIME_OUT';
  timestamp: string;
  latitude: number;
  longitude: number;
  ip_address: string | null;
  date: string;
  created_at: string;
};

function getIp(req?: any): string | null {
  if (!req) return null;
  const xf = req.headers?.['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) return xf.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || null;
}

function todayDate(): string {
  // Use Philippine Standard Time (UTC+8) — toISOString() would return UTC and record
  // the wrong date for punches made after midnight local time (4PM UTC prior day).
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}

@Injectable()
export class TimekeepingService {
  private readonly logger = new Logger(TimekeepingService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async timeIn(
    userId: string,
    companyId: string,
    dto: TimePunchDto,
    req?: any,
  ) {
    const supabase = this.supabaseService.getClient();
    const today = todayDate();

    const { data: existing, error: checkError } = await supabase
      .from('time_logs')
      .select('log_id, punch_type')
      .eq('user_id', userId)
      .eq('date', today)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle<TimeLogRow>();

    if (checkError) {
      this.logger.error(
        `DB error during time-in check for user: ${userId}`,
        checkError,
      );
      throw new Error(checkError.message);
    }

    if (existing?.punch_type === 'TIME_IN') {
      throw new BadRequestException(
        'You have already timed in today. Please time out before timing in again.',
      );
    }

    const { data: userProfile, error: profileError } = await supabase
      .from('user_profile')
      .select('employee_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (profileError) throw new Error(profileError.message);

    const now = new Date().toISOString();
    const log_id = crypto.randomUUID();

    const { error: insertError } = await supabase.from('time_logs').insert({
      log_id,
      user_id: userId,
      company_id: companyId,
      employee_id: userProfile?.employee_id ?? null,
      punch_type: 'TIME_IN',
      timestamp: now,
      latitude: dto.latitude,
      longitude: dto.longitude,
      ip_address: getIp(req),
      date: today,
    });

    if (insertError) {
      this.logger.error(
        `Failed to insert TIME_IN for user: ${userId}`,
        insertError,
      );
      throw new Error(insertError.message);
    }

    this.logger.log(`TIME_IN recorded — user: ${userId} at ${now}`);

    return {
      log_id,
      punch_type: 'TIME_IN',
      timestamp: now,
      latitude: dto.latitude,
      longitude: dto.longitude,
      date: today,
    };
  }

  async timeOut(
    userId: string,
    companyId: string,
    dto: TimePunchDto,
    req?: any,
  ) {
    const supabase = this.supabaseService.getClient();
    const today = todayDate();

    const { data: lastPunch, error: checkError } = await supabase
      .from('time_logs')
      .select('log_id, punch_type')
      .eq('user_id', userId)
      .eq('date', today)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle<TimeLogRow>();

    if (checkError) {
      this.logger.error(
        `DB error during time-out check for user: ${userId}`,
        checkError,
      );
      throw new Error(checkError.message);
    }

    if (!lastPunch) {
      throw new BadRequestException(
        'You have not timed in today. Please time in first.',
      );
    }

    if (lastPunch.punch_type === 'TIME_OUT') {
      throw new BadRequestException(
        'You have already timed out. Please time in again before timing out.',
      );
    }

    const { data: userProfile, error: profileError } = await supabase
      .from('user_profile')
      .select('employee_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (profileError) throw new Error(profileError.message);

    const now = new Date().toISOString();
    const log_id = crypto.randomUUID();

    const { error: insertError } = await supabase.from('time_logs').insert({
      log_id,
      user_id: userId,
      company_id: companyId,
      employee_id: userProfile?.employee_id ?? null,
      punch_type: 'TIME_OUT',
      timestamp: now,
      latitude: dto.latitude,
      longitude: dto.longitude,
      ip_address: getIp(req),
      date: today,
    });

    if (insertError) {
      this.logger.error(
        `Failed to insert TIME_OUT for user: ${userId}`,
        insertError,
      );
      throw new Error(insertError.message);
    }

    this.logger.log(`TIME_OUT recorded — user: ${userId} at ${now}`);

    return {
      log_id,
      punch_type: 'TIME_OUT',
      timestamp: now,
      latitude: dto.latitude,
      longitude: dto.longitude,
      date: today,
    };
  }

  async getMyStatus(userId: string) {
    const supabase = this.supabaseService.getClient();
    const today = todayDate();

    const { data, error } = await supabase
      .from('time_logs')
      .select('log_id, punch_type, timestamp, latitude, longitude')
      .eq('user_id', userId)
      .eq('date', today)
      .order('timestamp', { ascending: true });

    if (error) throw new Error(error.message);

    const logs = data ?? [];
    const lastPunch = logs.at(-1);

    return {
      date: today,
      current_status: lastPunch?.punch_type ?? null,
      time_in: logs.find((l) => l.punch_type === 'TIME_IN') ?? null,
      time_out: logs.find((l) => l.punch_type === 'TIME_OUT') ?? null,
    };
  }

  async getMyTimesheet(userId: string, from?: string, to?: string) {
    const supabase = this.supabaseService.getClient();

    let query = supabase
      .from('time_logs')
      .select('log_id, punch_type, timestamp, latitude, longitude, date')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false });

    if (from) query = query.gte('date', from);
    if (to) query = query.lte('date', to);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return this.groupByDate(data ?? []);
  }

  async getAllTimesheets(companyId: string, from?: string, to?: string) {
    const supabase = this.supabaseService.getClient();

    let query = supabase
      .from('time_logs')
      .select(
        `
        log_id,
        punch_type,
        timestamp,
        latitude,
        longitude,
        date,
        ip_address,
        user_id,
        employee_id,
        user_profile (first_name, last_name)
      `,
      )
      .eq('company_id', companyId)
      .order('timestamp', { ascending: false });

    if (from) query = query.gte('date', from);
    if (to) query = query.lte('date', to);

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
      .select('user_id, first_name, last_name, employee_id')
      .eq('user_id', targetUserId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (userError) throw new Error(userError.message);
    if (!targetUser)
      throw new NotFoundException('Employee not found in your company');

    const { data: logs, error: logsError } = await supabase
      .from('time_logs')
      .select('log_id, punch_type, timestamp, latitude, longitude, ip_address')
      .eq('user_id', targetUserId)
      .eq('date', date)
      .order('timestamp', { ascending: true });

    if (logsError) throw new Error(logsError.message);

    return {
      user_id: targetUser.user_id,
      employee_id: targetUser.employee_id,
      first_name: targetUser.first_name,
      last_name: targetUser.last_name,
      date,
      punches: logs ?? [],
    };
  }

  private groupByDate(logs: any[]) {
    const grouped: Record<
      string,
      { date: string; time_in: any | null; time_out: any | null }
    > = {};

    for (const log of logs) {
      if (!grouped[log.date]) {
        grouped[log.date] = { date: log.date, time_in: null, time_out: null };
      }
      if (log.punch_type === 'TIME_IN') grouped[log.date].time_in = log;
      if (log.punch_type === 'TIME_OUT') grouped[log.date].time_out = log;
    }

    return Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));
  }
}
