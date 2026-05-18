import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LeaveCategory, LEAVE_CATEGORIES } from './leave-categories';
import { UpsertEmployeeLeaveBalancesDto } from './dto/upsert-employee-leave-balances.dto';
import { CompanyDefaultLeaveBalancesDto } from './dto/company-default-leave-balances.dto';
import { BulkLeaveBalanceDto } from './dto/bulk-leave-balance.dto';

type BalanceRow = {
  employee_id: string;
  company_id: string;
  leave_category: LeaveCategory;
  entitled_days: number;
  used_days: number;
  balance_source: 'individual' | 'bulk' | 'default';
  updated_by?: string | null;
  updated_by_name?: string | null;
  updated_at?: string;
};

type DepartmentDefaultRow = {
  department_id: string;
  company_id: string;
  leave_category: LeaveCategory;
  default_days: number;
  updated_by?: string | null;
  updated_by_name?: string | null;
  updated_at?: string;
};

type TimeBalanceRow = {
  user_id: string;
  company_id: string;
  leave_type: string;
  year: number;
  allocated_days: number;
  used_days: number;
};

@Injectable()
export class LeaveBalancesService {
  private readonly logger = new Logger(LeaveBalancesService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private get db() {
    return this.supabaseService.getClient();
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private async resolveEmployeeId(userId: string): Promise<string | null> {
    const { data } = await this.db
      .from('user_profile')
      .select('employee_id')
      .eq('user_id', userId)
      .maybeSingle();
    return data?.employee_id ?? null;
  }

  private async resolveCompanyForEmployee(employeeId: string): Promise<string | null> {
    const { data } = await this.db
      .from('user_profile')
      .select('company_id')
      .eq('employee_id', employeeId)
      .maybeSingle();
    return data?.company_id ?? null;
  }

  private async getUpdaterName(userId?: string | null): Promise<string | null> {
    if (!userId) return null;
    const { data } = await this.db
      .from('user_profile')
      .select('first_name, last_name')
      .eq('user_id', userId)
      .maybeSingle();
    return data ? `${data.first_name ?? ''} ${data.last_name ?? ''}`.trim() || null : null;
  }

  private async getEmployeesForCompany(
    companyId: string,
  ): Promise<Array<{ user_id: string; employee_id: string; department_id: string | null }>> {
    const { data } = await this.db
      .from('user_profile')
      .select('user_id, employee_id, department_id')
      .eq('company_id', companyId)
      .not('employee_id', 'is', null);
    return (data ?? []) as Array<{ user_id: string; employee_id: string; department_id: string | null }>;
  }

  private get currentYear() {
    return new Date().getFullYear();
  }

  private async getUserIdByEmployeeId(employeeId: string): Promise<string | null> {
    const { data } = await this.db
      .from('user_profile')
      .select('user_id')
      .eq('employee_id', employeeId)
      .maybeSingle();
    return (data?.user_id as string | null | undefined) ?? null;
  }

  private async getTimeBalancesByUser(
    userId: string,
    companyId: string,
    year = this.currentYear,
  ): Promise<Map<LeaveCategory, TimeBalanceRow>> {
    const { data } = await this.db
      .from('time_leave_balances')
      .select('user_id, company_id, leave_type, year, allocated_days, used_days')
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .eq('year', year);

    const map = new Map<LeaveCategory, TimeBalanceRow>();
    for (const row of (data ?? []) as TimeBalanceRow[]) {
      map.set(row.leave_type as LeaveCategory, row);
    }
    return map;
  }

  private async upsertTimeBalanceAllocated(params: {
    userId: string;
    companyId: string;
    leaveType: LeaveCategory;
    allocatedDays: number;
    year?: number;
  }) {
    const year = params.year ?? this.currentYear;
    const { data: existing } = await this.db
      .from('time_leave_balances')
      .select('balance_id, used_days')
      .eq('user_id', params.userId)
      .eq('company_id', params.companyId)
      .eq('leave_type', params.leaveType)
      .eq('year', year)
      .maybeSingle();

    if (existing?.balance_id) {
      await this.db
        .from('time_leave_balances')
        .update({
          allocated_days: params.allocatedDays,
          updated_at: new Date().toISOString(),
        })
        .eq('balance_id', existing.balance_id);
      return;
    }

    await this.db.from('time_leave_balances').insert({
      user_id: params.userId,
      company_id: params.companyId,
      leave_type: params.leaveType,
      year,
      allocated_days: params.allocatedDays,
      used_days: 0,
    });
  }

  private async getEmployeeDepartmentId(employeeId: string): Promise<string | null> {
    const { data } = await this.db
      .from('user_profile')
      .select('department_id')
      .eq('employee_id', employeeId)
      .maybeSingle();
    return (data?.department_id as string | null | undefined) ?? null;
  }

  private async getDepartmentDefaultsMap(
    companyId: string,
    departmentId: string,
  ): Promise<Map<LeaveCategory, number>> {
    const { data, error } = await this.db
      .from('leave_balance_department_defaults')
      .select('*')
      .eq('company_id', companyId)
      .eq('department_id', departmentId);
    if (error) {
      const msg = String(error.message ?? '');
      // Migration not yet applied: keep page usable by treating as empty defaults.
      if (msg.includes('leave_balance_department_defaults')) {
        this.logger.warn(
          'leave_balance_department_defaults table is unavailable. Returning empty department defaults.',
        );
        return new Map<LeaveCategory, number>();
      }
      throw new Error(error.message);
    }

    return new Map(
      ((data ?? []) as DepartmentDefaultRow[]).map((r) => [
        r.leave_category,
        Number(r.default_days ?? 0),
      ]),
    );
  }

  // ── Company defaults ─────────────────────────────────────────────────────────

  async getCompanyDefaults(companyId: string) {
    const { data, error } = await this.db
      .from('leave_balance_company_defaults')
      .select('*')
      .eq('company_id', companyId);

    if (error) throw new Error(error.message);

    // Fill missing categories with 0
    const existing = new Map((data ?? []).map((r: any) => [r.leave_category as LeaveCategory, r]));
    return LEAVE_CATEGORIES.map((cat) =>
      existing.get(cat) ?? {
        company_id: companyId,
        leave_category: cat,
        default_days: 0,
        updated_by: null,
        updated_by_name: null,
        updated_at: null,
      },
    );
  }

  async upsertCompanyDefaults(
    companyId: string,
    dto: CompanyDefaultLeaveBalancesDto,
    updaterUserId?: string,
  ) {
    const updaterName = await this.getUpdaterName(updaterUserId ?? null);
    const now = new Date().toISOString();

    const rows = dto.items.map((item) => ({
      company_id: companyId,
      leave_category: item.leave_category,
      default_days: item.default_days,
      updated_by: updaterUserId ?? null,
      updated_by_name: updaterName,
      updated_at: now,
    }));

    const { error } = await this.db
      .from('leave_balance_company_defaults')
      .upsert(rows, { onConflict: 'company_id,leave_category' });

    if (error) throw new Error(error.message);

    // Propagate to employees whose rows are sourced from 'default'
    await this.syncDefaultSourcedEmployees(companyId, dto, updaterUserId);

    return this.getCompanyDefaults(companyId);
  }

  async getDepartmentDefaults(companyId: string, departmentId: string) {
    const existing = await this.getDepartmentDefaultsMap(companyId, departmentId);
    return LEAVE_CATEGORIES.map((cat) => ({
      company_id: companyId,
      department_id: departmentId,
      leave_category: cat,
      default_days: existing.get(cat) ?? 0,
    }));
  }

  async upsertDepartmentDefaults(
    companyId: string,
    departmentId: string,
    dto: CompanyDefaultLeaveBalancesDto,
    updaterUserId?: string,
  ) {
    const updaterName = await this.getUpdaterName(updaterUserId ?? null);
    const now = new Date().toISOString();

    const rows = dto.items.map((item) => ({
      company_id: companyId,
      department_id: departmentId,
      leave_category: item.leave_category,
      default_days: item.default_days,
      updated_by: updaterUserId ?? null,
      updated_by_name: updaterName,
      updated_at: now,
    }));

    const { error } = await this.db
      .from('leave_balance_department_defaults')
      .upsert(rows, { onConflict: 'department_id,leave_category' });
    if (error) {
      const msg = String(error.message ?? '');
      if (msg.includes('leave_balance_department_defaults')) {
        throw new Error(
          'Department leave defaults table is missing. Please run SQL migration 2026-05-18_leave_balance_department_defaults.sql first.',
        );
      }
      throw new Error(error.message);
    }

    // Keep current department-sourced employee balances aligned.
    await this.syncDepartmentSourcedEmployees(companyId, departmentId, dto, updaterUserId);

    return this.getDepartmentDefaults(companyId, departmentId);
  }

  private async syncDepartmentSourcedEmployees(
    companyId: string,
    departmentId: string,
    dto: CompanyDefaultLeaveBalancesDto,
    updaterUserId?: string,
  ) {
    const { data: employees } = await this.db
      .from('user_profile')
      .select('employee_id')
      .eq('company_id', companyId)
      .eq('department_id', departmentId)
      .not('employee_id', 'is', null);

    const empIds = (employees ?? []).map((e: any) => e.employee_id as string);
    if (!empIds.length) return;

    const updaterName = await this.getUpdaterName(updaterUserId ?? null);
    const now = new Date().toISOString();

    // Pull existing rows so we can preserve used_days and never override individual edits.
    const { data: existingRows } = await this.db
      .from('employee_leave_balances')
      .select('employee_id, leave_category, used_days, balance_source')
      .in('employee_id', empIds);

    const existingMap = new Map<string, { used_days: number; balance_source: string }>();
    for (const row of existingRows ?? []) {
      const r = row as any;
      existingMap.set(`${r.employee_id}::${r.leave_category}`, {
        used_days: Number(r.used_days ?? 0),
        balance_source: String(r.balance_source ?? 'default'),
      });
    }

    const rows: any[] = [];
    for (const empId of empIds) {
      for (const item of dto.items) {
        const key = `${empId}::${item.leave_category}`;
        const existing = existingMap.get(key);
        if (existing?.balance_source === 'individual') continue;

        rows.push({
          employee_id: empId,
          company_id: companyId,
          leave_category: item.leave_category,
          entitled_days: item.default_days,
          used_days: existing?.used_days ?? 0,
          balance_source: 'bulk',
          updated_by: updaterUserId ?? null,
          updated_by_name: updaterName,
          updated_at: now,
        });
      }
    }

    if (!rows.length) return;
    const { error } = await this.db
      .from('employee_leave_balances')
      .upsert(rows, { onConflict: 'employee_id,leave_category' });
    if (error) throw new Error(error.message);

    for (const row of rows) {
      const userId = await this.getUserIdByEmployeeId(row.employee_id as string);
      if (!userId) continue;
      await this.upsertTimeBalanceAllocated({
        userId,
        companyId,
        leaveType: row.leave_category as LeaveCategory,
        allocatedDays: Number(row.entitled_days ?? 0),
      });
    }
  }

  private async syncDefaultSourcedEmployees(
    companyId: string,
    dto: CompanyDefaultLeaveBalancesDto,
    updaterUserId?: string,
  ) {
    const employees = await this.getEmployeesForCompany(companyId);
    if (!employees.length) return;

    const updaterName = await this.getUpdaterName(updaterUserId ?? null);
    const now = new Date().toISOString();

    for (const emp of employees) {
      for (const item of dto.items) {
        // Only update rows whose source is 'default'
        await this.db
          .from('employee_leave_balances')
          .update({
            entitled_days: item.default_days,
            updated_by: updaterUserId ?? null,
            updated_by_name: updaterName,
            updated_at: now,
          })
          .eq('employee_id', emp.employee_id)
          .eq('leave_category', item.leave_category)
          .eq('balance_source', 'default');

        await this.upsertTimeBalanceAllocated({
          userId: emp.user_id,
          companyId,
          leaveType: item.leave_category,
          allocatedDays: item.default_days,
        });
      }
    }
  }

  async backfillCompanyDefaults(companyId: string, updaterUserId?: string) {
    const defaults = await this.getCompanyDefaults(companyId);
    const employees = await this.getEmployeesForCompany(companyId);
    const updaterName = await this.getUpdaterName(updaterUserId ?? null);
    const now = new Date().toISOString();

    let count = 0;
    for (const emp of employees) {
      for (const def of defaults) {
        const { data: existing } = await this.db
          .from('employee_leave_balances')
          .select('balance_source')
          .eq('employee_id', emp.employee_id)
          .eq('leave_category', def.leave_category)
          .maybeSingle();

        if (!existing) {
          await this.db.from('employee_leave_balances').insert({
            employee_id: emp.employee_id,
            company_id: companyId,
            leave_category: def.leave_category,
            entitled_days: (def as any).default_days ?? 0,
            used_days: 0,
            balance_source: 'default',
            updated_by: updaterUserId ?? null,
            updated_by_name: updaterName,
            updated_at: now,
          });
          count++;
        }

        await this.upsertTimeBalanceAllocated({
          userId: emp.user_id,
          companyId,
          leaveType: def.leave_category as LeaveCategory,
          allocatedDays: Number((def as any).default_days ?? 0),
        });
      }
    }

    return { backfilled: count };
  }

  async reconcileCompanyBalances(companyId: string, updaterUserId?: string) {
    const employees = await this.getEmployeesForCompany(companyId);
    if (!employees.length) return { employees: 0, categories_upserted: 0 };

    const defaults = await this.getCompanyDefaults(companyId);
    const defaultMap = new Map(
      defaults.map((d: any) => [d.leave_category as LeaveCategory, Number(d.default_days ?? 0)]),
    );
    const updaterName = await this.getUpdaterName(updaterUserId ?? null);
    const now = new Date().toISOString();
    const year = this.currentYear;

    let categoriesUpserted = 0;

    for (const emp of employees) {
      const [deptDefaults, existingRows, timeRows] = await Promise.all([
        emp.department_id
          ? this.getDepartmentDefaultsMap(companyId, emp.department_id)
          : Promise.resolve(new Map<LeaveCategory, number>()),
        this.db
          .from('employee_leave_balances')
          .select('leave_category, entitled_days, used_days, balance_source')
          .eq('employee_id', emp.employee_id)
          .eq('company_id', companyId),
        this.db
          .from('time_leave_balances')
          .select('leave_type, allocated_days, used_days')
          .eq('user_id', emp.user_id)
          .eq('company_id', companyId)
          .eq('year', year),
      ]);

      const existingMap = new Map(
        ((existingRows.data ?? []) as any[]).map((r) => [r.leave_category as LeaveCategory, r]),
      );
      const timeMap = new Map(
        ((timeRows.data ?? []) as any[]).map((r) => [r.leave_type as LeaveCategory, r]),
      );

      const employeeRows: any[] = [];
      const timeUpserts: any[] = [];

      for (const cat of LEAVE_CATEGORIES) {
        const existing = existingMap.get(cat);
        const time = timeMap.get(cat);

        const baselineEntitled =
          emp.department_id && deptDefaults.has(cat)
            ? Number(deptDefaults.get(cat) ?? 0)
            : Number(defaultMap.get(cat) ?? 0);

        const source: 'individual' | 'bulk' | 'default' =
          existing?.balance_source === 'individual'
            ? 'individual'
            : emp.department_id && deptDefaults.has(cat)
              ? 'bulk'
              : 'default';

        const entitled =
          source === 'individual'
            ? Number(existing?.entitled_days ?? baselineEntitled)
            : baselineEntitled;

        const used = Math.max(
          Number(existing?.used_days ?? 0),
          Number(time?.used_days ?? 0),
        );

        employeeRows.push({
          employee_id: emp.employee_id,
          company_id: companyId,
          leave_category: cat,
          entitled_days: entitled,
          used_days: used,
          balance_source: source,
          updated_by: updaterUserId ?? null,
          updated_by_name: updaterName,
          updated_at: now,
        });

        timeUpserts.push({
          user_id: emp.user_id,
          company_id: companyId,
          leave_type: cat,
          year,
          allocated_days: entitled,
          used_days: used,
          updated_at: now,
        });
      }

      const { error: balErr } = await this.db
        .from('employee_leave_balances')
        .upsert(employeeRows, { onConflict: 'employee_id,leave_category' });
      if (balErr) throw new Error(balErr.message);

      for (const row of timeUpserts) {
        const { data: existingTime, error: readErr } = await this.db
          .from('time_leave_balances')
          .select('balance_id')
          .eq('user_id', row.user_id)
          .eq('company_id', row.company_id)
          .eq('leave_type', row.leave_type)
          .eq('year', row.year)
          .maybeSingle();
        if (readErr) throw new Error(readErr.message);

        if (existingTime?.balance_id) {
          const { error: updateErr } = await this.db
            .from('time_leave_balances')
            .update({
              allocated_days: row.allocated_days,
              used_days: row.used_days,
              updated_at: row.updated_at,
            })
            .eq('balance_id', existingTime.balance_id);
          if (updateErr) throw new Error(updateErr.message);
        } else {
          const { error: insertErr } = await this.db.from('time_leave_balances').insert({
            user_id: row.user_id,
            company_id: row.company_id,
            leave_type: row.leave_type,
            year: row.year,
            allocated_days: row.allocated_days,
            used_days: row.used_days,
            updated_at: row.updated_at,
          });
          if (insertErr) throw new Error(insertErr.message);
        }
      }

      categoriesUpserted += employeeRows.length;
    }

    return { employees: employees.length, categories_upserted: categoriesUpserted };
  }

  // ── Employee balances ─────────────────────────────────────────────────────────

  async getRoster(companyId: string) {
    const employees = await this.getEmployeesForCompany(companyId);
    if (!employees.length) return [];

    const empIds = employees.map((e) => e.employee_id);

    const { data: rows, error } = await this.db
      .from('employee_leave_balances')
      .select('*')
      .in('employee_id', empIds);

    if (error) throw new Error(error.message);

    // Get profile info for display
    const { data: profiles } = await this.db
      .from('user_profile')
      .select('user_id, employee_id, first_name, last_name, department_id')
      .in('employee_id', empIds);

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.employee_id as string, p]));

    const balanceMap = new Map<string, Map<LeaveCategory, BalanceRow>>();
    for (const row of rows ?? []) {
      const r = row as BalanceRow;
      if (!balanceMap.has(r.employee_id)) balanceMap.set(r.employee_id, new Map());
      balanceMap.get(r.employee_id)!.set(r.leave_category, r);
    }

    const userIds = employees.map((e) => e.user_id);
    const { data: timeRows } = await this.db
      .from('time_leave_balances')
      .select('user_id, company_id, leave_type, year, allocated_days, used_days')
      .in('user_id', userIds)
      .eq('company_id', companyId)
      .eq('year', this.currentYear);

    const timeMap = new Map<string, Map<LeaveCategory, TimeBalanceRow>>();
    for (const row of (timeRows ?? []) as TimeBalanceRow[]) {
      if (!timeMap.has(row.user_id)) timeMap.set(row.user_id, new Map());
      timeMap.get(row.user_id)!.set(row.leave_type as LeaveCategory, row);
    }

    return employees.map((emp) => {
      const profile = profileMap.get(emp.employee_id);
      const catMap = balanceMap.get(emp.employee_id) ?? new Map();
      const userTimeMap = timeMap.get(emp.user_id) ?? new Map();
      const categories = LEAVE_CATEGORIES.map((cat) => {
        const b = catMap.get(cat);
        const t = userTimeMap.get(cat);
        const entitled = t
          ? Number(t.allocated_days)
          : Number(b?.entitled_days ?? 0);
        const used = t
          ? Number(t.used_days)
          : Number(b?.used_days ?? 0);
        return {
          leave_category: cat,
          entitled_days: entitled,
          used_days: used,
          remaining_days: entitled - used,
          balance_source: b?.balance_source ?? 'default',
        };
      });
      return {
        employee_id: emp.employee_id,
        user_id: emp.user_id,
        first_name: profile?.first_name ?? null,
        last_name: profile?.last_name ?? null,
        department_id: emp.department_id,
        categories,
      };
    });
  }

  async getEmployeeBalances(userId: string, companyId: string) {
    const employeeId = await this.resolveEmployeeId(userId);
    if (!employeeId) return { employee_id: null, categories: [] };

    const { data, error } = await this.db
      .from('employee_leave_balances')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('company_id', companyId);

    if (error) throw new Error(error.message);

    const rowMap = new Map((data ?? []).map((r: any) => [r.leave_category as LeaveCategory, r as BalanceRow]));
    const timeMap = await this.getTimeBalancesByUser(userId, companyId);

    const categories = LEAVE_CATEGORIES.map((cat) => {
      const b = rowMap.get(cat);
      const t = timeMap.get(cat);
      const entitled = t
        ? Number(t.allocated_days)
        : Number(b?.entitled_days ?? 0);
      const used = t
        ? Number(t.used_days)
        : Number(b?.used_days ?? 0);
      return {
        leave_category: cat,
        entitled_days: entitled,
        used_days: used,
        remaining_days: entitled - used,
        balance_source: b?.balance_source ?? 'default',
        updated_by_name: b?.updated_by_name ?? null,
        updated_at: b?.updated_at ?? null,
      };
    });

    return { employee_id: employeeId, categories };
  }

  async getMyBalances(userId: string) {
    const employeeId = await this.resolveEmployeeId(userId);
    if (!employeeId) return { categories: [] };

    const companyId = await this.resolveCompanyForEmployee(employeeId);
    if (!companyId) return { categories: [] };

    return this.getEmployeeBalances(userId, companyId);
  }

  async upsertEmployeeBalances(
    userId: string,
    companyId: string,
    dto: UpsertEmployeeLeaveBalancesDto,
    updaterUserId?: string,
  ) {
    const employeeId = await this.resolveEmployeeId(userId);
    if (!employeeId) throw new Error('Employee profile not found.');

    const updaterName = await this.getUpdaterName(updaterUserId ?? null);
    const now = new Date().toISOString();

    // Preserve used_days
    const { data: existing } = await this.db
      .from('employee_leave_balances')
      .select('leave_category, used_days')
      .eq('employee_id', employeeId)
      .eq('company_id', companyId);

    const usedMap = new Map(
      (existing ?? []).map((r: any) => [r.leave_category as LeaveCategory, Number(r.used_days)]),
    );

    const rows = dto.items.map((item) => ({
      employee_id: employeeId,
      company_id: companyId,
      leave_category: item.leave_category,
      entitled_days: item.entitled_days,
      used_days: usedMap.get(item.leave_category) ?? 0,
      balance_source: 'individual' as const,
      updated_by: updaterUserId ?? null,
      updated_by_name: updaterName,
      updated_at: now,
    }));

    const { error } = await this.db
      .from('employee_leave_balances')
      .upsert(rows, { onConflict: 'employee_id,leave_category' });

    if (error) throw new Error(error.message);

    for (const item of dto.items) {
      await this.upsertTimeBalanceAllocated({
        userId,
        companyId,
        leaveType: item.leave_category,
        allocatedDays: item.entitled_days,
      });
    }

    return this.getEmployeeBalances(userId, companyId);
  }

  async resetToDepartment(userId: string, companyId: string, updaterUserId?: string) {
    const employeeId = await this.resolveEmployeeId(userId);
    if (!employeeId) throw new Error('Employee profile not found.');

    const { data: profile } = await this.db
      .from('user_profile')
      .select('department_id')
      .eq('employee_id', employeeId)
      .maybeSingle();

    const departmentId = profile?.department_id ?? null;
    const baseline: Map<LeaveCategory, number> = new Map();

    if (departmentId) {
      const deptDefaults = await this.getDepartmentDefaultsMap(companyId, departmentId);
      for (const [cat, days] of deptDefaults.entries()) baseline.set(cat, days);
    }

    // Fallback to company defaults for missing categories
    const defaults = await this.getCompanyDefaults(companyId);
    for (const def of defaults) {
      if (!baseline.has(def.leave_category as LeaveCategory)) {
        baseline.set(def.leave_category as LeaveCategory, (def as any).default_days ?? 0);
      }
    }

    const updaterName = await this.getUpdaterName(updaterUserId ?? null);
    const now = new Date().toISOString();

    const { data: existing } = await this.db
      .from('employee_leave_balances')
      .select('leave_category, used_days')
      .eq('employee_id', employeeId)
      .eq('company_id', companyId);

    const usedMap = new Map(
      (existing ?? []).map((r: any) => [r.leave_category as LeaveCategory, Number(r.used_days)]),
    );

    const rows = LEAVE_CATEGORIES.map((cat) => ({
      employee_id: employeeId,
      company_id: companyId,
      leave_category: cat,
      entitled_days: baseline.get(cat) ?? 0,
      used_days: usedMap.get(cat) ?? 0,
      balance_source: departmentId ? ('bulk' as const) : ('default' as const),
      updated_by: updaterUserId ?? null,
      updated_by_name: updaterName,
      updated_at: now,
    }));

    const { error } = await this.db
      .from('employee_leave_balances')
      .upsert(rows, { onConflict: 'employee_id,leave_category' });

    if (error) throw new Error(error.message);

    for (const cat of LEAVE_CATEGORIES) {
      await this.upsertTimeBalanceAllocated({
        userId,
        companyId,
        leaveType: cat,
        allocatedDays: baseline.get(cat) ?? 0,
      });
    }

    return this.getEmployeeBalances(userId, companyId);
  }

  async resetToCompanyDefault(userId: string, companyId: string, updaterUserId?: string) {
    const employeeId = await this.resolveEmployeeId(userId);
    if (!employeeId) throw new Error('Employee profile not found.');

    const defaults = await this.getCompanyDefaults(companyId);
    const updaterName = await this.getUpdaterName(updaterUserId ?? null);
    const now = new Date().toISOString();

    const { data: existing } = await this.db
      .from('employee_leave_balances')
      .select('leave_category, used_days')
      .eq('employee_id', employeeId)
      .eq('company_id', companyId);

    const usedMap = new Map(
      (existing ?? []).map((r: any) => [r.leave_category as LeaveCategory, Number(r.used_days)]),
    );

    const rows = defaults.map((def: any) => ({
      employee_id: employeeId,
      company_id: companyId,
      leave_category: def.leave_category as LeaveCategory,
      entitled_days: def.default_days ?? 0,
      used_days: usedMap.get(def.leave_category as LeaveCategory) ?? 0,
      balance_source: 'default' as const,
      updated_by: updaterUserId ?? null,
      updated_by_name: updaterName,
      updated_at: now,
    }));

    const { error } = await this.db
      .from('employee_leave_balances')
      .upsert(rows, { onConflict: 'employee_id,leave_category' });

    if (error) throw new Error(error.message);

    for (const def of defaults as any[]) {
      await this.upsertTimeBalanceAllocated({
        userId,
        companyId,
        leaveType: def.leave_category as LeaveCategory,
        allocatedDays: Number(def.default_days ?? 0),
      });
    }

    return this.getEmployeeBalances(userId, companyId);
  }

  async bulkAssign(companyId: string, dto: BulkLeaveBalanceDto, updaterUserId?: string) {
    const updaterName = await this.getUpdaterName(updaterUserId ?? null);
    const now = new Date().toISOString();

    let employeeIds: string[] = [];

    if (dto.scope === 'company') {
      const emps = await this.getEmployeesForCompany(companyId);
      employeeIds = emps.map((e) => e.employee_id);
    } else if (dto.scope === 'department' && dto.department_id) {
      const { data } = await this.db
        .from('user_profile')
        .select('employee_id')
        .eq('company_id', companyId)
        .eq('department_id', dto.department_id)
        .not('employee_id', 'is', null);
      employeeIds = (data ?? []).map((r: any) => r.employee_id as string);
    } else if (dto.scope === 'employees' && dto.user_ids?.length) {
      const { data } = await this.db
        .from('user_profile')
        .select('employee_id')
        .eq('company_id', companyId)
        .in('user_id', dto.user_ids)
        .not('employee_id', 'is', null);
      employeeIds = (data ?? []).map((r: any) => r.employee_id as string);
    }

    if (!employeeIds.length) return { assigned: 0 };

    // Preserve used_days for existing rows
    const { data: existing } = await this.db
      .from('employee_leave_balances')
      .select('employee_id, leave_category, used_days')
      .in('employee_id', employeeIds);

    const usedMap = new Map<string, number>();
    for (const row of existing ?? []) {
      usedMap.set(`${(row as any).employee_id}::${(row as any).leave_category}`, Number((row as any).used_days));
    }

    const rows: any[] = [];
    for (const empId of employeeIds) {
      for (const item of dto.items) {
        rows.push({
          employee_id: empId,
          company_id: companyId,
          leave_category: item.leave_category,
          entitled_days: item.entitled_days,
          used_days: usedMap.get(`${empId}::${item.leave_category}`) ?? 0,
          balance_source: dto.scope === 'company' ? 'default' : 'bulk',
          updated_by: updaterUserId ?? null,
          updated_by_name: updaterName,
          updated_at: now,
        });
      }
    }

    const { error } = await this.db
      .from('employee_leave_balances')
      .upsert(rows, { onConflict: 'employee_id,leave_category' });

    if (error) throw new Error(error.message);

    for (const row of rows) {
      const userId = await this.getUserIdByEmployeeId(row.employee_id as string);
      if (!userId) continue;
      await this.upsertTimeBalanceAllocated({
        userId,
        companyId,
        leaveType: row.leave_category as LeaveCategory,
        allocatedDays: Number(row.entitled_days ?? 0),
      });
    }

    return { assigned: employeeIds.length };
  }

  // ── Deduct used days (called by timekeeping reviewAbsenceRequest) ─────────────

  async deductLeaveBalance(
    employeeId: string,
    companyId: string,
    leaveCategory: LeaveCategory,
    days: number,
  ): Promise<void> {
    const { data: row, error: fetchErr } = await this.db
      .from('employee_leave_balances')
      .select('entitled_days, used_days')
      .eq('employee_id', employeeId)
      .eq('company_id', companyId)
      .eq('leave_category', leaveCategory)
      .maybeSingle();

    if (fetchErr) throw new Error(fetchErr.message);

    const entitled = Number(row?.entitled_days ?? 0);
    const used = Number(row?.used_days ?? 0);
    const remaining = entitled - used;

    if (remaining < days) {
      throw new Error(
        `Insufficient ${leaveCategory} balance: ${remaining} day(s) remaining, ${days} requested.`,
      );
    }

    const { error: updateErr } = await this.db
      .from('employee_leave_balances')
      .update({ used_days: used + days, updated_at: new Date().toISOString() })
      .eq('employee_id', employeeId)
      .eq('leave_category', leaveCategory);

    if (updateErr) throw new Error(updateErr.message);
  }

  // ── Auto-assign hook (called at employee create / dept change / onboarding) ───

  async assignInitialLeaveBalancesForEmployee(params: {
    companyId: string;
    employeeId: string;
    departmentId?: string | null;
    updatedByName?: string | null;
  }): Promise<{ source: string }> {
    const { companyId, employeeId, departmentId, updatedByName } = params;
    const now = new Date().toISOString();

    // Check existing rows — preserve individual ones, skip entirely if all set
    const { data: existingRows } = await this.db
      .from('employee_leave_balances')
      .select('leave_category, balance_source, entitled_days, used_days')
      .eq('employee_id', employeeId)
      .eq('company_id', companyId);

    const existing = new Map(
      (existingRows ?? []).map((r: any) => [r.leave_category as LeaveCategory, r as BalanceRow]),
    );

    const resolvedDepartmentId = departmentId ?? (await this.getEmployeeDepartmentId(employeeId));
    const deptBaseline =
      resolvedDepartmentId
        ? await this.getDepartmentDefaultsMap(companyId, resolvedDepartmentId)
        : null;

    const defaults = await this.getCompanyDefaults(companyId);
    const defaultMap = new Map(defaults.map((d: any) => [d.leave_category as LeaveCategory, Number(d.default_days)]));

    const rows: any[] = [];
    let source = 'default';

    for (const cat of LEAVE_CATEGORIES) {
      const existingRow = existing.get(cat);
      if (existingRow?.balance_source === 'individual') continue; // preserve individual

      const existingUsed = existingRow ? Number(existingRow.used_days) : 0;

      if (resolvedDepartmentId && deptBaseline?.has(cat)) {
        rows.push({
          employee_id: employeeId,
          company_id: companyId,
          leave_category: cat,
          entitled_days: deptBaseline.get(cat)!,
          used_days: existingUsed,
          balance_source: 'bulk',
          updated_by_name: updatedByName ?? null,
          updated_at: now,
        });
        source = 'bulk';
      } else {
        rows.push({
          employee_id: employeeId,
          company_id: companyId,
          leave_category: cat,
          entitled_days: defaultMap.get(cat) ?? 0,
          used_days: existingUsed,
          balance_source: 'default',
          updated_by_name: updatedByName ?? null,
          updated_at: now,
        });
      }
    }

    if (rows.length) {
      const { error } = await this.db
        .from('employee_leave_balances')
        .upsert(rows, { onConflict: 'employee_id,leave_category' });
      if (error) this.logger.warn(`assignInitialLeaveBalances error: ${error.message}`);

      const userId = await this.getUserIdByEmployeeId(employeeId);
      if (userId) {
        for (const row of rows) {
          await this.upsertTimeBalanceAllocated({
            userId,
            companyId,
            leaveType: row.leave_category as LeaveCategory,
            allocatedDays: Number(row.entitled_days ?? 0),
          });
        }
      }
    }

    return { source };
  }
}
