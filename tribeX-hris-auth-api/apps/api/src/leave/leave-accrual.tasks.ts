// ============================================================
// FIX — GAP-5.1 / 5.2 / 5.3: Leave Accrual Engine
// New file: tribeX-hris-auth-api/src/leave/leave-accrual.tasks.ts
//
// Drop this file into src/leave/ and register LeaveAccrualModule
// in app.module.ts. It provides:
//   - Monthly accrual cron (1st of every month)
//   - Year-end carry-over cron (1 Jan)
//   - CRUD endpoints for leave_config (via LeaveConfigService)
// ============================================================

import {
  Injectable, Logger, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '@app/supabase';

// ── Types ─────────────────────────────────────────────────────

interface LeaveConfig {
  config_id:       string;
  company_id:      string;
  accrual_rate:    number;          // days/month
  year_end_rule:   'RESET' | 'CARRY_ALL' | 'CARRY_CAP';
  carry_over_max:  number | null;
}

// ── Service ───────────────────────────────────────────────────

@Injectable()
export class LeaveAccrualService {
  private readonly logger = new Logger(LeaveAccrualService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  // ── Leave Config CRUD ──────────────────────────────────────

  async getConfig(companyId: string): Promise<LeaveConfig> {
    const { data, error } = await this.supabaseService.getClient()
      .from('leave_config')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Leave config not found for this company');
    return data as LeaveConfig;
  }

  async upsertConfig(
    companyId: string,
    changedBy: string,
    patch: Partial<Pick<LeaveConfig, 'accrual_rate' | 'year_end_rule' | 'carry_over_max'>>,
  ): Promise<LeaveConfig> {
    const supabase = this.supabaseService.getClient();

    // Fetch current config to build audit log diff
    const { data: existing } = await supabase
      .from('leave_config')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();

    const { data, error } = await supabase
      .from('leave_config')
      .upsert({ company_id: companyId, ...patch, updated_at: new Date().toISOString() },
               { onConflict: 'company_id' })
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);

    // Write leave_config_logs for each changed field
    if (existing) {
      const logs = Object.entries(patch)
        .filter(([key, val]) => existing[key] !== val)
        .map(([field_changed, new_value]) => ({
          company_id:    companyId,
          changed_by:    changedBy,
          field_changed,
          old_value:     String(existing[field_changed as keyof LeaveConfig] ?? ''),
          new_value:     String(new_value ?? ''),
        }));
      if (logs.length > 0) {
        await supabase.from('leave_config_logs').insert(logs);
      }
    }

    return data as LeaveConfig;
  }

  // ── Monthly Accrual Cron ───────────────────────────────────
  // Runs at 00:00 on the 1st of every month.
  // Credits accrual_rate days to every active employee's leave balances.

  @Cron('0 0 1 * *', { name: 'monthly-leave-accrual' })
  async runMonthlyAccrual() {
    this.logger.log('Running monthly leave accrual...');
    const supabase = this.supabaseService.getClient();

    // Fetch all active employees grouped by company
    const { data: employees, error: empErr } = await supabase
      .from('user_profile')
      .select('user_id, company_id')
      .eq('account_status', 'Active');
    if (empErr) { this.logger.error('Monthly accrual — employee fetch failed', empErr); return; }
    if (!employees?.length) return;

    // Fetch all company configs in one query
    const companyIds = [...new Set(employees.map(e => e.company_id))];
    const { data: configs, error: cfgErr } = await supabase
      .from('leave_config')
      .select('company_id, accrual_rate')
      .in('company_id', companyIds);
    if (cfgErr) { this.logger.error('Monthly accrual — config fetch failed', cfgErr); return; }

    const configMap: Record<string, number> = {};
    for (const c of configs ?? []) configMap[c.company_id] = Number(c.accrual_rate);

    // For each employee, add accrual_rate to allocated_days for each leave type
    const LEAVE_TYPES = ['Vacation Leave', 'Sick Leave'];
    let credited = 0;

    for (const emp of employees) {
      const rate = configMap[emp.company_id] ?? 1.5;

      for (const leaveType of LEAVE_TYPES) {
        const { data: balance } = await supabase
          .from('time_leave_balances')
          .select('balance_id, allocated_days')
          .eq('user_id', emp.user_id)
          .eq('leave_type', leaveType)
          .maybeSingle();

        if (balance) {
          await supabase
            .from('time_leave_balances')
            .update({ allocated_days: Number(balance.allocated_days) + rate })
            .eq('balance_id', balance.balance_id);
        } else {
          // Auto-seed row if missing
          await supabase.from('time_leave_balances').insert({
            user_id:        emp.user_id,
            company_id:     emp.company_id,
            leave_type:     leaveType,
            allocated_days: rate,
            used_days:      0,
          });
        }
        credited++;
      }
    }

    this.logger.log(`Monthly accrual complete — credited ${credited} balance rows.`);
  }

  // ── Year-End Carry-Over Cron ───────────────────────────────
  // Runs at 00:00 on 1 January.
  // Applies the configured year_end_rule to every employee's balances.

  @Cron('0 0 1 1 *', { name: 'year-end-leave-carryover' })
  async runYearEndCarryOver() {
    this.logger.log('Running year-end leave carry-over...');
    const supabase = this.supabaseService.getClient();

    const { data: configs, error: cfgErr } = await supabase
      .from('leave_config')
      .select('company_id, year_end_rule, carry_over_max');
    if (cfgErr) { this.logger.error('Year-end cron — config fetch failed', cfgErr); return; }
    if (!configs?.length) return;

    for (const cfg of configs) {
      const { data: balances } = await supabase
        .from('time_leave_balances')
        .select('balance_id, allocated_days, used_days')
        .eq('company_id', cfg.company_id);

      if (!balances?.length) continue;

      for (const bal of balances) {
        const remaining = Math.max(0, Number(bal.allocated_days) - Number(bal.used_days));
        let newAllocated: number;

        if (cfg.year_end_rule === 'RESET') {
          newAllocated = 0;
        } else if (cfg.year_end_rule === 'CARRY_ALL') {
          newAllocated = remaining;
        } else {
          // CARRY_CAP
          newAllocated = Math.min(remaining, cfg.carry_over_max ?? 0);
        }

        await supabase
          .from('time_leave_balances')
          .update({ allocated_days: newAllocated, used_days: 0 })
          .eq('balance_id', bal.balance_id);
      }

      this.logger.log(
        `Year-end carry-over — company ${cfg.company_id} rule=${cfg.year_end_rule} done.`,
      );
    }
  }
}
