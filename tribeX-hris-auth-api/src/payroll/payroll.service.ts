import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { DatabaseErrorHandler } from '../common/database-error.handler';
import { CnbService } from '../cnb/cnb.service';
import { CnbEncryptionService } from '../cnb/cnb-encryption.service';
import { TimekeepingService } from '../timekeeping/timekeeping.service';
import { OvertimeService } from '../overtime/overtime.service';

@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly cnbService: CnbService,
    private readonly encryption: CnbEncryptionService,
    private readonly timekeepingService: TimekeepingService,
    private readonly overtimeService: OvertimeService,
  ) {}

  // ──────────────────────────────────────────────────────────────
  // EMPLOYEE: Get own payslips
  // GET /payroll/me/payslips
  // Returns shape expected by frontend payrollApi.ts PayslipEntry[]
  // ──────────────────────────────────────────────────────────────
  async getMyPayslips(userId: string) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('cnb_payslips')
      .select(
        `payslip_id, basic_pay_earned, total_allowances, gross_pay,
         tax_deduction, total_deductions, net_pay, status, employee_ack_status,
         acknowledged_at, created_at,
         period:period_id(period_id, cutoff_start_date, cutoff_end_date, payout_date)`,
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      DatabaseErrorHandler.handle(error, 'getMyPayslips', this.logger);
    }

    return (data ?? []).map((row: any) => ({
      payslip_id: row.payslip_id,
      pay_period: row.period
        ? this.formatPayPeriod(row.period.cutoff_start_date, row.period.cutoff_end_date)
        : 'Unknown',
      basic_pay: this.encryption.decryptToNumber(row.basic_pay_earned),
      allowances: this.encryption.decryptToNumber(row.total_allowances),
      deductions: this.encryption.decryptToNumber(row.total_deductions),
      tax: this.encryption.decryptToNumber(row.tax_deduction),
      net_pay: this.encryption.decryptToNumber(row.net_pay),
      status: row.status,
      employee_ack_status: row.employee_ack_status,
      created_at: row.created_at,
      payout_date: row.period?.payout_date ?? null,
    }));
  }

  // ──────────────────────────────────────────────────────────────
  // HR: Get payroll ledger (all employees for a cutoff)
  // GET /payroll/ledger?cutoff=YYYY-MM-DD
  // Returns shape expected by frontend PayrollLedgerEntry[]
  // ──────────────────────────────────────────────────────────────
  async getPayrollLedger(companyId: string, cutoffDate?: string) {
    const supabase = this.supabaseService.getClient();

    // Find the matching period(s)
    let periodQuery = supabase
      .from('cnb_payroll_periods')
      .select('period_id, cutoff_start_date, cutoff_end_date, payout_date, status')
      .eq('company_id', companyId)
      .order('payout_date', { ascending: false });

    if (cutoffDate) {
      periodQuery = periodQuery.eq('payout_date', cutoffDate) as any;
    }

    const { data: periods, error: periodsErr } = await periodQuery.limit(1);
    if (periodsErr) {
      DatabaseErrorHandler.handle(periodsErr, 'getPayrollLedger-periods', this.logger);
    }

    if (!periods || periods.length === 0) {
      return [];
    }

    const period = periods[0] as any;

    const { data: payslips, error: payslipsErr } = await supabase
      .from('cnb_payslips')
      .select(
        `payslip_id, user_id, basic_pay_earned, gross_pay, total_deductions, net_pay, status`,
      )
      .eq('period_id', period.period_id)
      .eq('company_id', companyId);

    if (payslipsErr) {
      DatabaseErrorHandler.handle(payslipsErr, 'getPayrollLedger-payslips', this.logger);
    }

    if (!payslips || payslips.length === 0) return [];

    // Enrich with employee info
    const userIds = payslips.map((p: any) => p.user_id);
    const { data: users } = await supabase
      .from('user_profile')
      .select('user_id, employee_id, first_name, last_name')
      .in('user_id', userIds);

    const userMap = new Map(
      (users ?? []).map((u: any) => [
        u.user_id,
        { employee_id: u.employee_id, name: `${u.first_name} ${u.last_name}` },
      ]),
    );

    return payslips.map((p: any) => {
      const emp = userMap.get(p.user_id);
      return {
        payroll_id: p.payslip_id,
        employee_id: emp?.employee_id ?? p.user_id,
        employee_name: emp?.name ?? 'Unknown',
        cutoff_date: period.payout_date,
        gross_pay: this.encryption.decryptToNumber(p.gross_pay),
        deductions: this.encryption.decryptToNumber(p.total_deductions),
        net_pay: this.encryption.decryptToNumber(p.net_pay),
        status: this.mapPayslipStatus(p.status),
      };
    });
  }

  // ──────────────────────────────────────────────────────────────
  // HR: Run (generate) payroll for a cutoff date
  // POST /payroll/cutoff/run   { cutoff_date: "YYYY-MM-DD" }
  // ──────────────────────────────────────────────────────────────
  async runPayrollCutoff(companyId: string, actorId: string, cutoffDate: string) {
    const supabase = this.supabaseService.getClient();

    if (!cutoffDate || !/^\d{4}-\d{2}-\d{2}$/.test(cutoffDate)) {
      throw new BadRequestException('cutoff_date must be YYYY-MM-DD format.');
    }

    // Find or create a payroll period for this cutoff
    let period: any;

    const { data: existing } = await supabase
      .from('cnb_payroll_periods')
      .select('*')
      .eq('company_id', companyId)
      .eq('payout_date', cutoffDate)
      .maybeSingle();

    if (existing) {
      if (existing.status === 'Processed') {
        throw new BadRequestException(
          `Payroll for cutoff ${cutoffDate} has already been processed.`,
        );
      }
      period = existing;
    } else {
      // Auto-create a period if one doesn't exist
      const cutoffEnd = new Date(cutoffDate);
      const cutoffStart = new Date(cutoffEnd);
      cutoffStart.setDate(1); // default: 1st of the month

      const { data: created, error: createErr } = await supabase
        .from('cnb_payroll_periods')
        .insert({
          period_id: crypto.randomUUID(),
          company_id: companyId,
          cutoff_start_date: cutoffStart.toISOString().split('T')[0],
          cutoff_end_date: cutoffDate,
          payout_date: cutoffDate,
          status: 'Draft',
          processed_by: actorId,
        })
        .select()
        .single();

      if (createErr) {
        DatabaseErrorHandler.handle(createErr, 'runPayrollCutoff-create', this.logger);
      }
      period = created;
    }

    // Get all employees who have an employee_id assigned (same filter as cnb.service.ts).
    // We intentionally do NOT filter by account_status because test/staging environments
    // commonly leave employees in non-Active states while still needing payroll computed.
    const { data: employees, error: empErr } = await supabase
      .from('user_profile')
      .select('user_id, employee_id, first_name, last_name')
      .eq('company_id', companyId)
      .not('employee_id', 'is', null);

    if (empErr) {
      DatabaseErrorHandler.handle(empErr, 'runPayrollCutoff-employees', this.logger);
    }
    if (!employees || employees.length === 0) {
      throw new BadRequestException('No employees with an assigned employee_id found.');
    }

    // Mark period as Processing
    await supabase
      .from('cnb_payroll_periods')
      .update({ status: 'Processing', processed_by: actorId })
      .eq('period_id', period.period_id);

    // Batch-check which employees already have a payslip for this period
    const { data: existingSlips } = await supabase
      .from('cnb_payslips')
      .select('user_id')
      .eq('period_id', period.period_id)
      .eq('company_id', companyId);

    const alreadyProcessed = new Set(
      (existingSlips ?? []).map((s: any) => s.user_id as string),
    );

    const pending = employees.filter((e) => !alreadyProcessed.has(e.user_id));
    let generated = alreadyProcessed.size;
    let skipped = 0;

    // Process all pending employees in parallel — independent computations, no ordering needed
    const outcomes = await Promise.allSettled(
      pending.map((employee) =>
        this.generatePayslipForEmployee(supabase, employee.user_id, companyId, period),
      ),
    );

    for (let i = 0; i < outcomes.length; i++) {
      const result = outcomes[i];
      if (result.status === 'fulfilled') {
        generated++;
      } else {
        this.logger.warn(
          `Skipped payslip for ${pending[i].user_id}: ${result.reason?.message ?? result.reason}`,
        );
        skipped++;
      }
    }

    // Mark period as Processed
    await supabase
      .from('cnb_payroll_periods')
      .update({
        status: 'Processed',
        processed_at: new Date().toISOString(),
      })
      .eq('period_id', period.period_id);

    // Write audit trail
    await supabase.from('cnb_audit_trail').insert({
      audit_id: crypto.randomUUID(),
      company_id: companyId,
      actor_id: actorId,
      action_type: 'PAYROLL_RUN',
      target_table: 'cnb_payroll_periods',
      target_record_id: period.period_id,
      new_value: JSON.stringify({ cutoff_date: cutoffDate, generated, skipped }),
      timestamp: new Date().toISOString(),
    });

    this.logger.log(
      `Payroll run complete — period: ${period.period_id}, generated: ${generated}, skipped: ${skipped}`,
    );

    return {
      message: `Payroll processed for cutoff ${cutoffDate}.`,
      period_id: period.period_id,
      generated,
      skipped,
    };
  }

  // ──────────────────────────────────────────────────────────────
  // INTERNAL: Compute and insert one payslip
  // Includes attendance-based adjustments:
  // - Pro-rata salary for absences
  // - Tardiness deductions
  // - Overtime pay
  // - Attendance bonus (if rate >= threshold)
  // ──────────────────────────────────────────────────────────────
  private async generatePayslipForEmployee(
    supabase: ReturnType<SupabaseService['getClient']>,
    userId: string,
    companyId: string,
    period: any,
  ) {
    // Use CnbService methods so salary/benefit amounts are already decrypted.
    // Pass cutoff_end_date so we only pick up records effective on or before the period end.
    const salaryRow = await this.cnbService.getSalaryBaseline(userId, companyId, period.cutoff_end_date);

    if (!salaryRow) {
      throw new BadRequestException('No salary baseline found for this employee.');
    }

    const basicSalary = parseFloat(salaryRow.basic_salary) || 0;

    // Active benefits effective on or before the cutoff end date
    const benefitRows = await this.cnbService.getEmployeeBenefits(userId, companyId, period.cutoff_end_date);

    let totalAllowances = 0;
    for (const b of benefitRows) {
      const amt = parseFloat(b.amount) || 0;
      if (b.benefit_type !== 'one_time_incentive') {
        totalAllowances += amt;
      }
    }

    // Fetch attendance data for the payroll period
    const attendanceData = await this.getAttendanceForPeriod(
      userId,
      period.cutoff_start_date,
      period.cutoff_end_date,
    );

    // Calculate attendance-based adjustments
    const absenceDeduction = await this.calculateAbsenceDeduction(basicSalary, attendanceData);
    const tardinessDeduction = this.calculateTardinessDeduction(basicSalary, attendanceData);
    const overtimePay = this.calculateOvertimePay(basicSalary, attendanceData);
    const attendanceBonus = this.calculateAttendanceBonus(basicSalary, attendanceData);

    // Adjusted basic pay (after pro-rata for absences)
    const adjustedBasicSalary = Math.max(0, basicSalary - absenceDeduction);
    const grossPay = adjustedBasicSalary + totalAllowances + overtimePay + attendanceBonus;

    const taxDeduction = await this.computeTax(supabase, companyId, grossPay, period.cutoff_end_date);
    const statutoryDeductionsAmount = this.computeStatutory(adjustedBasicSalary);
    const totalDeductions = taxDeduction + statutoryDeductionsAmount + tardinessDeduction;

    const netPay = grossPay - totalDeductions;

    const { error } = await supabase.from('cnb_payslips').insert({
      payslip_id: crypto.randomUUID(),
      period_id: period.period_id,
      user_id: userId,
      company_id: companyId,
      basic_pay_earned: this.encryption.encryptNumber(Math.round(adjustedBasicSalary * 100) / 100),
      total_allowances: this.encryption.encryptNumber(Math.round(totalAllowances * 100) / 100),
      gross_pay: this.encryption.encryptNumber(Math.round(grossPay * 100) / 100),
      tax_deduction: this.encryption.encryptNumber(Math.round(taxDeduction * 100) / 100),
      statutory_deductions: this.encryption.encryptNumber(Math.round(statutoryDeductionsAmount * 100) / 100),
      total_deductions: this.encryption.encryptNumber(Math.round(totalDeductions * 100) / 100),
      net_pay: this.encryption.encryptNumber(Math.round(netPay * 100) / 100),
      status: 'Pending Review',
      employee_ack_status: 'Pending',
      attendance_metadata: JSON.stringify({
        absences: attendanceData.totalAbsences,
        late_hours: attendanceData.totalLateHours,
        overtime_hours: attendanceData.totalOvertimeHours,
        attendance_rate: attendanceData.attendanceRate,
        absence_deduction: Math.round(absenceDeduction * 100) / 100,
        tardiness_deduction: Math.round(tardinessDeduction * 100) / 100,
        overtime_pay: Math.round(overtimePay * 100) / 100,
        attendance_bonus: Math.round(attendanceBonus * 100) / 100,
      }),
    });

    if (error) {
      DatabaseErrorHandler.handle(error, 'generatePayslipForEmployee', this.logger);
    }
  }

  // ──────────────────────────────────────────────────────────────
  // INTERNAL: Compute income tax from cnb_tax_brackets
  // ──────────────────────────────────────────────────────────────
  private async computeTax(
    supabase: ReturnType<SupabaseService['getClient']>,
    companyId: string,
    grossPay: number,
    referenceDate: string,
  ): Promise<number> {
    const year = new Date(referenceDate).getFullYear();

    const { data: bracket } = await supabase
      .from('cnb_tax_brackets')
      .select('base_tax_amount, min_salary, excess_percentage')
      .eq('company_id', companyId)
      .eq('effective_year', year)
      .lte('min_salary', grossPay)
      .gte('max_salary', grossPay)
      .limit(1)
      .maybeSingle();

    if (!bracket) return 0;

    const excess = grossPay - Number(bracket.min_salary);
    const tax =
      Number(bracket.base_tax_amount) +
      excess * (Number(bracket.excess_percentage) / 100);

    return Math.max(0, tax);
  }

  // ──────────────────────────────────────────────────────────────
  // INTERNAL: Compute statutory deductions (SSS + PhilHealth + Pag-IBIG)
  // Using 2024 Philippine standard rates as defaults
  // ──────────────────────────────────────────────────────────────
  private computeStatutory(basicSalary: number): number {
    // SSS: ~4.5% employee share, capped at ~900/month
    const sss = Math.min(basicSalary * 0.045, 900);
    // PhilHealth: 5% total, employee pays 2.5%, capped at ~2,500/month
    const philhealth = Math.min(basicSalary * 0.025, 2500);
    // Pag-IBIG: 2%, capped at 200/month
    const pagibig = Math.min(basicSalary * 0.02, 200);

    return sss + philhealth + pagibig;
  }

  // ──────────────────────────────────────────────────────────────
  // UTILITY
  // ──────────────────────────────────────────────────────────────
  private formatPayPeriod(start: string, end: string): string {
    const s = new Date(start);
    const e = new Date(end);
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    const sMonth = months[s.getMonth()];
    const eMonth = months[e.getMonth()];
    const year = e.getFullYear();

    if (s.getMonth() === e.getMonth()) {
      return `${sMonth} ${s.getDate()}–${e.getDate()}, ${year}`;
    }
    return `${sMonth} ${s.getDate()} – ${eMonth} ${e.getDate()}, ${year}`;
  }

  private mapPayslipStatus(status: string): 'draft' | 'processed' | 'released' {
    const map: Record<string, 'draft' | 'processed' | 'released'> = {
      'Pending Review': 'draft',
      Approved: 'processed',
      Released: 'released',
      'Final Pay': 'released',
    };
    return map[status] ?? 'draft';
  }

  // ──────────────────────────────────────────────────────────────
  // ATTENDANCE CALCULATIONS
  // ──────────────────────────────────────────────────────────────

  /**
   * Fetch attendance records for payroll period
   */
  private async getAttendanceForPeriod(
    userId: string,
    startDate: string,
    endDate: string,
    companyId?: string,
  ): Promise<{
    totalAbsences: number;
    totalLateHours: number;
    totalOvertimeHours: number;
    attendanceRate: number;
    scheduledDays: number;
    workingDays: number;
  }> {
    const supabase = this.supabaseService.getClient();

    // Get employee ID from user
    const { data: userProfile } = await supabase
      .from('user_profile')
      .select('employee_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!userProfile?.employee_id) {
      return {
        totalAbsences: 0,
        totalLateHours: 0,
        totalOvertimeHours: 0,
        attendanceRate: 100,
        scheduledDays: 0,
        workingDays: 0,
      };
    }

    // Fetch attendance logs for the period
    const { data: logs, error } = await supabase
      .from('attendance_time_logs')
      .select('log_type, log_status, timestamp, clock_type')
      .eq('employee_id', userProfile.employee_id)
      .gte('timestamp', `${startDate}T00:00:00Z`)
      .lte('timestamp', `${endDate}T23:59:59Z`);

    if (error) {
      this.logger.warn(`Failed to fetch attendance for payroll period: ${error.message}`);
      return {
        totalAbsences: 0,
        totalLateHours: 0,
        totalOvertimeHours: 0,
        attendanceRate: 100,
        scheduledDays: 0,
        workingDays: 0,
      };
    }

    // Count absences, late hours, overtime
    let absences = 0;
    let lateHours = 0;
    let overtimeHours = 0;
    const daysWorked = new Set<string>();
    const lateDays = new Set<string>();

    for (const log of logs ?? []) {
      const date = log.timestamp.split('T')[0];
      daysWorked.add(date);

      if (log.log_type === 'absence' && log.log_status !== 'DENIED') {
        absences++;
        daysWorked.delete(date); // Remove from working days
      } else if (log.clock_type === 'LATE' && log.log_status !== 'PENDING') {
        lateDays.add(date);
      }
    }

    // Replace heuristic with sum of approved overtime requests for the period
    if (userProfile?.employee_id) {
      overtimeHours = await this.overtimeService.getApprovedOtHoursForPeriod(
        userProfile.employee_id,
        startDate,
        endDate,
      );
    }

    lateHours = lateDays.size * 0.5; // Approximate 30 min late per day

    const workingDays = daysWorked.size;
    const scheduledDays = this.getBusinessDaysInRange(startDate, endDate);
    const attendanceRate =
      scheduledDays > 0 ? Math.round(((scheduledDays - absences) / scheduledDays) * 100) : 100;

    return {
      totalAbsences: absences,
      totalLateHours: lateHours,
      totalOvertimeHours: overtimeHours,
      attendanceRate,
      scheduledDays,
      workingDays,
    };
  }

  /**
   * Calculate absence deduction (pro-rata basis)
   * For each absence day, deduct 1 day of basic salary
   */
  private async calculateAbsenceDeduction(
    basicSalary: number,
    attendanceData: any,
  ): Promise<number> {
    const dailyRate = basicSalary / 22; // Assuming 22 working days per month
    return attendanceData.totalAbsences * dailyRate;
  }

  /**
   * Calculate tardiness deduction
   * Deduct 50 pesos per late hour (configurable)
   */
  private calculateTardinessDeduction(basicSalary: number, attendanceData: any): number {
    const LATE_DEDUCTION_PER_HOUR = 50; // Philippine pesos
    return attendanceData.totalLateHours * LATE_DEDUCTION_PER_HOUR;
  }

  /**
   * Calculate overtime pay
   * Pay 1.25x hourly rate for overtime hours
   */
  private calculateOvertimePay(basicSalary: number, attendanceData: any): number {
    const dailyRate = basicSalary / 22;
    const hourlyRate = dailyRate / 8; // Assuming 8-hour workday
    const overtimeRate = hourlyRate * 1.25; // 1.25x for overtime
    return attendanceData.totalOvertimeHours * overtimeRate;
  }

  /**
   * Calculate attendance bonus
   * 5% bonus if attendance >= 95%
   * 3% bonus if attendance >= 90%
   * 1% bonus if attendance >= 85%
   */
  private calculateAttendanceBonus(basicSalary: number, attendanceData: any): number {
    const { attendanceRate } = attendanceData;

    if (attendanceRate >= 95) {
      return basicSalary * 0.05;
    } else if (attendanceRate >= 90) {
      return basicSalary * 0.03;
    } else if (attendanceRate >= 85) {
      return basicSalary * 0.01;
    }

    return 0;
  }

  /**
   * Get number of business days (Mon-Fri) in a date range
   */
  private getBusinessDaysInRange(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let businessDays = 0;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        businessDays++;
      }
    }

    return businessDays;
  }
}
