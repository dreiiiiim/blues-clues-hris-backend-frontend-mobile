import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import { CnbEncryptionService } from '../cnb/cnb-encryption.service';
import { SupabaseService } from '@app/supabase';

@Injectable()
export class PerformanceService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly encryption: CnbEncryptionService,
  ) {}

  private get db() {
    return this.supabaseService.getClient();
  }

  // ── Helper: get all cycle IDs for a company (for history queries) ─────────
  private async getAllCycleIds(companyId: string): Promise<string[]> {
    const { data } = await this.db
      .from('performance_management_cycle')
      .select('perf_cycle_id')
      .eq('company_id', companyId);
    return (data || []).map((c: any) => c.perf_cycle_id);
  }

  // ── Helper: get eval IDs for a cycle (for PIP/rewards scoping) ────────────
  private async getEvalIdsForCycle(cycleId: string): Promise<string[]> {
    const { data } = await this.db
      .from('performance_evaluations')
      .select('perf_eval_id')
      .eq('perf_cycle_id', cycleId);
    return (data || []).map((e: any) => e.perf_eval_id);
  }

  // ── Helper: get active cycle for company ──────────────────────────────────
  private async getActiveCycle(companyId: string) {
    const { data, error } = await this.db
      .from('performance_management_cycle')
      .select('*')
      .eq('company_id', companyId)
      .neq('status', 'COMPLETED')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // ── Helper: log activity ──────────────────────────────────────────────────
  private async logActivity(opts: {
    company_id: string;
    action: string;
    performed_by?: string;
    actor_role?: string;
    target_user_id?: string;
    module_area?: string;
  }) {
    await this.db.from('performance_activity_logs').insert({
      company_id: opts.company_id,
      action: opts.action,
      performed_by: opts.performed_by || null,
      actor_role: opts.actor_role || null,
      target_user_id: opts.target_user_id || null,
      module_area: opts.module_area || null,
    });
  }

  // ── Helper: derive actor_role string from role_name ───────────────────────
  private actorRole(roleName: string): string {
    if (['Active Employee', 'Employee'].includes(roleName)) return 'EMPLOYEE';
    if (['Manager', 'Group Head'].includes(roleName)) return 'MANAGER';
    if ([
      'HR Officer',
      'HR Recruiter',
      'HR Interviewer',
      'HR Performance Management Officer',
    ].includes(roleName)) return 'HR';
    if (['System Admin', 'Admin'].includes(roleName)) return 'SYSTEM_ADMIN';
    return roleName;
  }

  // ── Helper: calculate bonus or merit amount from a bonus rule ────────────
  private roundCurrency(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private normalizePipStatus(status: string | null | undefined): string | undefined {
    if (!status) return undefined;
    return status === 'FAILED' ? 'TERMINATED' : status;
  }

  private async ensureRewardBenefitCatalog(companyId: string, rewardType: string): Promise<string | null> {
    if (rewardType === 'PROMOTION') return null;

    const benefitName =
      rewardType === 'MERIT_INCREASE' ? 'Performance Merit Increase' : 'Performance Bonus';

    const { data: existing, error: existingError } = await this.db
      .from('cnb_benefits_catalog')
      .select('benefit_id')
      .eq('company_id', companyId)
      .eq('benefit_name', benefitName)
      .maybeSingle();
    if (existingError) throw new BadRequestException(existingError.message);
    if (existing?.benefit_id) return existing.benefit_id;

    const { data: created, error: createError } = await this.db
      .from('cnb_benefits_catalog')
      .insert({
        benefit_id: crypto.randomUUID(),
        company_id: companyId,
        benefit_name: benefitName,
        benefit_type: 'one_time_incentive',
        taxable: true,
        default_amount: 0,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .select('benefit_id')
      .single();
    if (createError) throw new BadRequestException(createError.message);
    return created.benefit_id;
  }

  private async syncRewardIntoPayroll(rewardId: string) {
    const { data: reward, error: rewardError } = await this.db
      .from('performance_rewards')
      .select('perf_rewards_id, perf_eval_id, reward_type, amount_value, is_synced')
      .eq('perf_rewards_id', rewardId)
      .maybeSingle();
    if (rewardError) throw new BadRequestException(rewardError.message);
    if (!reward) throw new NotFoundException('Reward not found');
    if (reward.is_synced) return reward;

    const { data: evaluation, error: evaluationError } = await this.db
      .from('performance_evaluations')
      .select('user_id, perf_cycle_id')
      .eq('perf_eval_id', reward.perf_eval_id)
      .maybeSingle();
    if (evaluationError) throw new BadRequestException(evaluationError.message);
    if (!evaluation) throw new NotFoundException('Evaluation not found for reward');

    const { data: cycle, error: cycleError } = await this.db
      .from('performance_management_cycle')
      .select('company_id')
      .eq('perf_cycle_id', evaluation.perf_cycle_id)
      .maybeSingle();
    if (cycleError) throw new BadRequestException(cycleError.message);
    if (!cycle?.company_id) throw new NotFoundException('Company not found for reward');

    if (reward.reward_type !== 'PROMOTION') {
      const benefitId = await this.ensureRewardBenefitCatalog(cycle.company_id, reward.reward_type);
      const amount = this.roundCurrency(Number(reward.amount_value || 0));

      if (benefitId && amount > 0) {
        const { error: benefitError } = await this.db
          .from('cnb_employee_benefits')
          .insert({
            mapping_id: crypto.randomUUID(),
            user_id: evaluation.user_id,
            benefit_id: benefitId,
            amount: this.encryption.encryptNumber(amount),
            effective_date: new Date().toISOString().slice(0, 10),
          });
        if (benefitError) throw new BadRequestException(benefitError.message);
      }

      // GAP-6.1 FIX: For MERIT_INCREASE, write a new salary baseline row
      // and record an audit trail entry with old→new salary bound to perf_eval_id.
      if (reward.reward_type === 'MERIT_INCREASE' && amount > 0) {
        const { data: currentBaseline, error: baselineReadErr } = await this.db
          .from('cnb_salary_baselines')
          .select('baseline_id, basic_salary, company_id')
          .eq('user_id', evaluation.user_id)
          .order('effective_date', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (baselineReadErr) throw new BadRequestException(baselineReadErr.message);

        if (currentBaseline) {
          const oldSalaryRaw = this.encryption.decryptToNumber(
            currentBaseline.basic_salary ?? '0',
          );
          const newSalary = this.roundCurrency(oldSalaryRaw + amount);

          const { error: newBaselineErr } = await this.db
            .from('cnb_salary_baselines')
            .insert({
              baseline_id:   crypto.randomUUID(),
              user_id:       evaluation.user_id,
              company_id:    currentBaseline.company_id,
              basic_salary:  this.encryption.encryptNumber(newSalary),
              effective_date: new Date().toISOString().slice(0, 10),
            });
          if (newBaselineErr) throw new BadRequestException(newBaselineErr.message);

          const { error: auditErr } = await this.db
            .from('cnb_audit_trail')
            .insert({
              trail_id:     crypto.randomUUID(),
              company_id:   cycle.company_id,
              performed_by: evaluation.user_id,
              action_type:  'MERIT_INCREASE',
              target_table: 'cnb_salary_baselines',
              target_id:    evaluation.user_id,
              old_value:    JSON.stringify({ basic_salary: oldSalaryRaw }),
              new_value:    JSON.stringify({
                basic_salary: newSalary,
                perf_eval_id: reward.perf_eval_id,
                merit_amount: amount,
              }),
            });
          if (auditErr) throw new BadRequestException(auditErr.message);
        }
      }
    }

    const { data: synced, error: syncError } = await this.db
      .from('performance_rewards')
      .update({ is_synced: true })
      .eq('perf_rewards_id', rewardId)
      .select()
      .single();
    if (syncError) throw new BadRequestException(syncError.message);
    return synced;
  }

  private calcRewardAmount(rule: any, baseSalary: number, type: 'bonus' | 'merit'): number {
    if (rule.amount_type === 'fixed') {
      return type === 'bonus' ? (rule.bonus_fixed_amount ?? 0) : (rule.merit_fixed_amount ?? 0);
    }
    const pct = type === 'bonus' ? rule.bonus_pct : rule.merit_increase_pct;
    return baseSalary * (pct / 100);
  }

  // ── Helper: map goal DB row to frontend shape ─────────────────────────────
  private mapGoal(g: any) {
    let status = 'In Progress';
    let statusColor = '#3b82f6';
    let isPending = false;
    if (g.status === 'PENDING_APPROVAL') { status = 'Pending Approval'; statusColor = '#8b5cf6'; isPending = true; }
    else if (g.status === 'REJECTED') { status = 'Rejected'; statusColor = '#ef4444'; }
    else if (g.status === 'APPROVED' || g.status === 'ACHIEVED') {
      if ((g.progress_pct ?? 0) >= 100) { status = 'Achieved'; statusColor = '#10b981'; }
      else if ((g.progress_pct ?? 0) < 30) { status = 'At Risk'; statusColor = '#ef4444'; }
    }
    return {
      id: g.perf_goals_id,
      user_id: g.user_id,
      category: g.bsc_category,
      title: g.goal_name,
      desc: g.kpi_description,
      progress: g.progress_pct ?? 0,
      status,
      statusColor,
      isPending,
      priority: g.priority,
      deadline: g.deadline,
      set_by: g.set_by,
      approved_by: g.approved_by,
      approved_at: g.approved_at,
      rejected_reason: g.rejected_reason,
    };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SETTINGS
  // ────────────────────────────────────────────────────────────────────────────

  async getFullSettings(companyId: string) {
    const [settingsRes, violRulesRes, bonusRulesRes] = await Promise.all([
      this.db.from('performance_cycle_settings').select('*').eq('company_id', companyId).maybeSingle(),
      this.db.from('performance_violation_rules').select('*').eq('company_id', companyId).eq('is_active', true).order('created_at', { ascending: true }),
      this.db.from('performance_bonus_rules').select('*').eq('company_id', companyId).eq('is_active', true).order('rating_min', { ascending: true }),
    ]);
    const violRules = (violRulesRes.data || []).map((r: any) => ({
      ...r,
      id: r.rule_id,
      condition: `${r.violation_count} ${r.severity_threshold} violations`,
      action: r.resulting_action,
      affectedBenefits: [r.affects_bonus && 'Bonus', r.affects_merit && 'Merit Increase', r.affects_perks && 'Benefits/Perks'].filter(Boolean).join(', '),
    }));
    const bonusRules = (bonusRulesRes.data || []).map((r: any) => ({ ...r, id: r.bonus_rule_id }));
    return { settings: settingsRes.data, violation_rules: violRules, bonus_rules: bonusRules };
  }

  async saveFullSettings(companyId: string, userId: string, body: any) {
    const { settings, violation_rules, bonus_rules } = body;
    if (settings) {
      const { error } = await this.db.from('performance_cycle_settings').upsert(
        { ...settings, company_id: companyId, updated_by: userId },
        { onConflict: 'company_id' },
      );
      if (error) throw new BadRequestException(error.message);
    }
    if (violation_rules !== undefined) {
      await this.db.from('performance_violation_rules').delete().eq('company_id', companyId);
      if (violation_rules.length > 0) {
        const rows = violation_rules.map((r: any) => ({ ...r, company_id: companyId, is_active: true }));
        const { error } = await this.db.from('performance_violation_rules').insert(rows);
        if (error) throw new BadRequestException(error.message);
      }
    }
    if (bonus_rules !== undefined) {
      await this.db.from('performance_bonus_rules').update({ is_active: false }).eq('company_id', companyId);
      if (bonus_rules.length > 0) {
        const rows = bonus_rules.map((r: any) => {
          const { id, bonus_rule_id, ...rest } = r;
          return { ...rest, company_id: companyId, is_active: true };
        });
        const { error } = await this.db.from('performance_bonus_rules').insert(rows);
        if (error) throw new BadRequestException(error.message);
      }
    }
    await this.logActivity({ company_id: companyId, action: 'Performance settings updated', performed_by: userId, actor_role: 'SYSTEM_ADMIN', module_area: 'SETTINGS' });
    return { message: 'Settings saved' };
  }

  async createViolationRule(companyId: string, dto: any) {
    let { violation_count, severity_threshold, resulting_action, affects_bonus, affects_merit, affects_perks, rule_description, within_days, suspension_days, condition, action, affectedBenefits } = dto;
    // Parse display strings if structured fields not provided
    if (!violation_count && condition) {
      const m = condition.match(/^(\d+)\s+(\w+)/);
      if (m) { violation_count = parseInt(m[1]); severity_threshold = m[2]; }
    }
    if (!resulting_action && action) resulting_action = action.toUpperCase().replace(/\s+/g, '_');
    if (affectedBenefits && affects_bonus === undefined) {
      affects_bonus = affectedBenefits.includes('Bonus');
      affects_merit = affectedBenefits.includes('Merit');
      affects_perks = affectedBenefits.includes('Perks') || affectedBenefits.includes('Benefits');
    }
    const { data, error } = await this.db.from('performance_violation_rules').insert({
      company_id: companyId, violation_count, severity_threshold, resulting_action,
      affects_bonus: affects_bonus ?? false, affects_merit: affects_merit ?? false,
      affects_perks: affects_perks ?? false, rule_description: rule_description || null,
      within_days: within_days || null, suspension_days: suspension_days || null, is_active: true,
    }).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteViolationRule(ruleId: string, companyId: string) {
    const { error } = await this.db.from('performance_violation_rules').update({ is_active: false })
      .eq('rule_id', ruleId).eq('company_id', companyId);
    if (error) throw new BadRequestException(error.message);
    return { message: 'Rule deleted' };
  }

  async createBonusRule(companyId: string, dto: any) {
    const { data, error } = await this.db.from('performance_bonus_rules').insert({ ...dto, company_id: companyId, is_active: true }).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateBonusRule(ruleId: string, companyId: string, dto: any) {
    const { data, error } = await this.db.from('performance_bonus_rules').update(dto).eq('bonus_rule_id', ruleId).eq('company_id', companyId).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteBonusRule(ruleId: string, companyId: string) {
    const { error } = await this.db.from('performance_bonus_rules').update({ is_active: false }).eq('bonus_rule_id', ruleId).eq('company_id', companyId);
    if (error) throw new BadRequestException(error.message);
    return { message: 'Bonus rule deleted' };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // CYCLES
  // ────────────────────────────────────────────────────────────────────────────

  async getCycles(companyId: string) {
    const { data, error } = await this.db.from('performance_management_cycle').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
    if (error) throw new BadRequestException(error.message);
    return data || [];
  }

  async getActiveCyclePublic(companyId: string) {
    const cycle = await this.getActiveCycle(companyId);
    if (!cycle) throw new NotFoundException('No active performance cycle found');
    return cycle;
  }

  async createCycle(companyId: string, userId: string, dto: any) {
    const { data, error } = await this.db.from('performance_management_cycle').insert({
      company_id: companyId, cycle_name: dto.cycle_name, start_date: dto.start_date,
      end_date: dto.end_date, status: dto.status || 'GOAL_SETTING',
    }).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async patchCycle(cycleId: string, companyId: string, dto: any) {
    const { data, error } = await this.db.from('performance_management_cycle').update(dto)
      .eq('perf_cycle_id', cycleId).eq('company_id', companyId).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteCycle(cycleId: string, companyId: string) {
    const [goalsRes, evalsRes] = await Promise.all([
      this.db.from('performance_goals').select('perf_goals_id', { count: 'exact' }).eq('perf_cycle_id', cycleId).limit(1),
      this.db.from('performance_evaluations').select('perf_eval_id', { count: 'exact' }).eq('perf_cycle_id', cycleId).limit(1),
    ]);
    if ((goalsRes.count || 0) > 0 || (evalsRes.count || 0) > 0) {
      throw new BadRequestException('Cannot delete a cycle that has associated goals or evaluations. Mark it as COMPLETED instead.');
    }
    const { error } = await this.db.from('performance_management_cycle')
      .delete().eq('perf_cycle_id', cycleId).eq('company_id', companyId);
    if (error) throw new BadRequestException(error.message);
    return { message: 'Cycle deleted' };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // GOALS
  // ────────────────────────────────────────────────────────────────────────────

  async getMyGoals(userId: string, companyId: string) {
    const cycle = await this.getActiveCycle(companyId);
    if (!cycle) return [];
    const { data, error } = await this.db.from('performance_goals').select('*')
      .eq('user_id', userId).eq('perf_cycle_id', cycle.perf_cycle_id).order('created_at', { ascending: false });
    if (error) throw new BadRequestException(error.message);
    return (data || []).map(this.mapGoal.bind(this));
  }

  async getTeamGoals(managerId: string, companyId: string) {
    const cycle = await this.getActiveCycle(companyId);
    if (!cycle) return [];
    const { data: teamMembers } = await this.db.from('user_profile').select('user_id').eq('company_id', companyId).neq('user_id', managerId);
    if (!teamMembers || teamMembers.length === 0) return [];
    const userIds = teamMembers.map((u: any) => u.user_id);
    const { data, error } = await this.db.from('performance_goals').select('*')
      .in('user_id', userIds).eq('perf_cycle_id', cycle.perf_cycle_id).order('created_at', { ascending: false });
    if (error) throw new BadRequestException(error.message);
    return (data || []).map(this.mapGoal.bind(this));
  }

  async getAllGoals(companyId: string) {
    const cycle = await this.getActiveCycle(companyId);
    if (!cycle) return [];
    const { data: teamMembers } = await this.db.from('user_profile').select('user_id').eq('company_id', companyId);
    if (!teamMembers || teamMembers.length === 0) return [];
    const userIds = teamMembers.map((u: any) => u.user_id);
    const { data, error } = await this.db.from('performance_goals').select('*')
      .in('user_id', userIds).eq('perf_cycle_id', cycle.perf_cycle_id).order('created_at', { ascending: false });
    if (error) throw new BadRequestException(error.message);
    return (data || []).map(this.mapGoal.bind(this));
  }

  async createGoal(requesterId: string, requesterRole: string, companyId: string, dto: any) {
    // Check settings
    const { data: settings } = await this.db.from('performance_cycle_settings').select('self_proposed_goals_enabled').eq('company_id', companyId).maybeSingle();
    const isEmployee = ['Active Employee', 'Employee'].includes(requesterRole);
    if (isEmployee && settings && settings.self_proposed_goals_enabled === false) {
      throw new ForbiddenException('Self-proposed goals are disabled.');
    }
    const cycle = await this.getActiveCycle(companyId);
    if (!cycle) throw new BadRequestException('No active performance cycle found.');
    const targetUserId = dto.user_id || requesterId;
    const { data, error } = await this.db.from('performance_goals').insert({
      user_id: targetUserId, perf_cycle_id: cycle.perf_cycle_id,
      bsc_category: dto.category, goal_name: dto.title,
      kpi_description: dto.kpi, target_value: dto.target,
      deadline: dto.deadline || null, set_by: requesterId,
      priority: dto.priority || 'MEDIUM', status: 'PENDING_APPROVAL', progress_pct: 0,
    }).select().single();
    if (error) throw new BadRequestException(error.message);
    await this.logActivity({ company_id: companyId, action: `Goal proposed: ${dto.title}`, performed_by: requesterId, actor_role: this.actorRole(requesterRole), target_user_id: targetUserId, module_area: 'GOAL_SETTING' });
    return this.mapGoal(data);
  }

  async patchGoal(goalId: string, requesterId: string, companyId: string, dto: any) {
    const { data, error } = await this.db.from('performance_goals').update({
      ...(dto.title && { goal_name: dto.title }),
      ...(dto.category && { bsc_category: dto.category }),
      ...(dto.kpi && { kpi_description: dto.kpi }),
      ...(dto.target && { target_value: dto.target }),
      ...(dto.deadline !== undefined && { deadline: dto.deadline }),
      ...(dto.progress_pct !== undefined && { progress_pct: dto.progress_pct }),
      ...(dto.status && { status: dto.status }),
    }).eq('perf_goals_id', goalId).select().single();
    if (error) throw new BadRequestException(error.message);
    return this.mapGoal(data);
  }

  async deleteGoal(goalId: string, requesterId: string, companyId: string) {
    const { data: goal } = await this.db.from('performance_goals').select('status, set_by').eq('perf_goals_id', goalId).maybeSingle();
    if (!goal) throw new BadRequestException('Goal not found');
    if (goal.status === 'APPROVED') throw new BadRequestException('Cannot delete an approved goal. Reject it first via HR.');
    const { error } = await this.db.from('performance_goals').delete().eq('perf_goals_id', goalId);
    if (error) throw new BadRequestException(error.message);
    return { message: 'Goal deleted' };
  }

  async approveGoal(goalId: string, approverId: string, companyId: string) {
    const { data, error } = await this.db.from('performance_goals').update({
      status: 'APPROVED', approved_by: approverId, approved_at: new Date().toISOString(),
    }).eq('perf_goals_id', goalId).select().single();
    if (error) throw new BadRequestException(error.message);
    await this.logActivity({ company_id: companyId, action: `Goal approved`, performed_by: approverId, actor_role: 'HR', target_user_id: data.user_id, module_area: 'GOAL_SETTING' });
    return this.mapGoal(data);
  }

  async rejectGoal(goalId: string, approverId: string, companyId: string, reason?: string) {
    const { data, error } = await this.db.from('performance_goals').update({
      status: 'REJECTED', rejected_reason: reason || null,
    }).eq('perf_goals_id', goalId).select().single();
    if (error) throw new BadRequestException(error.message);
    return this.mapGoal(data);
  }

  async getGoalProgress(goalId: string) {
    const { data, error } = await this.db.from('performance_goal_progress').select('*').eq('perf_goals_id', goalId).order('created_at', { ascending: false });
    if (error) throw new BadRequestException(error.message);
    return data || [];
  }

  async addGoalProgress(goalId: string, userId: string, companyId: string, dto: any) {
    if (dto.progress_pct < 0 || dto.progress_pct > 100)
      throw new BadRequestException('progress_pct must be between 0 and 100');
    const { data, error } = await this.db.from('performance_goal_progress').insert({
      perf_goals_id: goalId, recorded_by: userId, progress_pct: dto.progress_pct,
      progress_value: dto.progress_value || `${dto.progress_pct}%`,
      checkpoint_type: dto.checkpoint_type || 'MANUAL',
      notes: dto.notes || null, recorded_at: new Date().toISOString(),
    }).select().single();
    if (error) throw new BadRequestException(error.message);
    // Also update the goal's progress_pct
    await this.db.from('performance_goals').update({ progress_pct: dto.progress_pct }).eq('perf_goals_id', goalId);
    return data;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // EVALUATIONS
  // ────────────────────────────────────────────────────────────────────────────

  private async buildGoalsChecklist(userId: string, cycleId: string) {
    const { data: goals } = await this.db.from('performance_goals').select('goal_name, progress_pct').eq('user_id', userId).eq('perf_cycle_id', cycleId);
    return (goals || []).map((g: any) => ({ label: g.goal_name, checked: (g.progress_pct || 0) >= 100 }));
  }

  async getMyEvaluations(userId: string, companyId: string) {
    const cycle = await this.getActiveCycle(companyId);
    if (!cycle) return [];
    const { data, error } = await this.db.from('performance_evaluations').select('*').eq('user_id', userId).eq('perf_cycle_id', cycle.perf_cycle_id).order('created_at', { ascending: false });
    if (error) throw new BadRequestException(error.message);
    const evals = data || [];
    for (const e of evals) {
      // Get reviewer name
      if (e.review_by) {
        const { data: reviewer } = await this.db.from('user_profile').select('first_name, last_name').eq('user_id', e.review_by).maybeSingle();
        e.review_by_name = reviewer ? `${reviewer.first_name} ${reviewer.last_name}` : null;
      }
      e.goals_checklist = await this.buildGoalsChecklist(userId, cycle.perf_cycle_id);
    }
    return evals;
  }

  async getMyEvaluationHistory(userId: string, companyId: string) {
    const cycleIds = await this.getAllCycleIds(companyId);
    if (cycleIds.length === 0) return [];
    // Fetch evaluations scoped to company cycles, then join cycle dates separately
    const { data, error } = await this.db
      .from('performance_evaluations')
      .select('perf_eval_id, perf_cycle_id, scale_rating, rating_status')
      .eq('user_id', userId)
      .in('perf_cycle_id', cycleIds)
      .eq('review_period', 'YEAR_END')
      .eq('perf_status', 'Approved')
      .order('created_at', { ascending: false });
    if (error) throw new BadRequestException(error.message);
    if (!data || data.length === 0) return [];
    // Fetch cycle start dates for year labels
    const { data: cycles } = await this.db
      .from('performance_management_cycle')
      .select('perf_cycle_id, start_date, cycle_name')
      .in('perf_cycle_id', cycleIds);
    const cycleMap: Record<string, any> = {};
    for (const c of (cycles || [])) cycleMap[c.perf_cycle_id] = c;
    return data.map((e: any) => {
      const cyc = cycleMap[e.perf_cycle_id];
      return {
        year: cyc?.start_date ? new Date(cyc.start_date).getFullYear().toString() : '',
        cycle: cyc?.cycle_name ?? 'ANNUAL',
        score: String(e.scale_rating),
        label: e.rating_status,
        status: e.rating_status === 'FAIL' ? 'FAIL' : 'PASS',
      };
    });
  }

  async getTeamEvaluations(managerId: string, companyId: string) {
    const cycle = await this.getActiveCycle(companyId);
    if (!cycle) return [];
    const { data: team } = await this.db.from('user_profile').select('user_id').eq('company_id', companyId).neq('user_id', managerId);
    if (!team || team.length === 0) return [];
    const ids = team.map((u: any) => u.user_id);
    const { data, error } = await this.db.from('performance_evaluations').select('*').in('user_id', ids).eq('perf_cycle_id', cycle.perf_cycle_id);
    if (error) throw new BadRequestException(error.message);
    return data || [];
  }

  async getAllEvaluations(companyId: string) {
    const cycle = await this.getActiveCycle(companyId);
    if (!cycle) return [];
    const { data: team } = await this.db.from('user_profile').select('user_id').eq('company_id', companyId);
    if (!team || team.length === 0) return [];
    const ids = team.map((u: any) => u.user_id);
    const { data, error } = await this.db.from('performance_evaluations').select('*').in('user_id', ids).eq('perf_cycle_id', cycle.perf_cycle_id);
    if (error) throw new BadRequestException(error.message);
    return data || [];
  }

  async getEvaluationById(evalId: string) {
    const { data, error } = await this.db.from('performance_evaluations').select('*').eq('perf_eval_id', evalId).maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Evaluation not found');
    return data;
  }

  async createEvaluation(reviewerId: string, reviewerRole: string, companyId: string, dto: any) {
    const cycle = await this.getActiveCycle(companyId);
    if (!cycle) throw new BadRequestException('No active performance cycle');
    const { data, error } = await this.db.from('performance_evaluations').insert({
      user_id: dto.user_id, perf_cycle_id: cycle.perf_cycle_id,
      review_by: reviewerId, review_period: dto.review_period,
      scale_rating: dto.scale_rating, rating_status: dto.rating_status,
      perf_comments: dto.perf_comments || null, perf_status: 'Pending by HR',
      review_type: dto.review_period === 'YEAR_END' ? 'ANNUAL' : 'INTERIM',
    }).select().single();
    if (error) throw new BadRequestException(error.message);
    // Update goals based on goal_results
    if (dto.goal_results && dto.goal_results.length > 0) {
      for (const gr of dto.goal_results) {
        if (gr.completed) {
          await this.db.from('performance_goals').update({ progress_pct: 100, status: 'ACHIEVED' }).eq('perf_goals_id', gr.perf_goals_id);
        }
      }
    }
    // Fetch cycle settings and bonus data once for both recommendation and auto-compute paths
    const { data: cycleSettings } = await this.db.from('performance_cycle_settings')
      .select('auto_compute_bonuses').eq('company_id', companyId).maybeSingle();
    const needsBonusData = (dto.recommendations?.bonus || dto.recommendations?.merit) || cycleSettings?.auto_compute_bonuses;
    let sharedRule: any = null;
    let sharedBaseSalary = 0;
    if (needsBonusData) {
      const [ruleRes, salaryRes] = await Promise.all([
        this.db.from('performance_bonus_rules').select('*').eq('company_id', companyId).eq('is_active', true)
          .lte('rating_min', dto.scale_rating).gte('rating_max', dto.scale_rating).maybeSingle(),
        this.db.from('cnb_salary_baselines').select('basic_salary').eq('user_id', dto.user_id)
          .order('effective_date', { ascending: false }).limit(1).maybeSingle(),
      ]);
      sharedRule = ruleRes.data;
      sharedBaseSalary = parseFloat(String(salaryRes.data?.basic_salary || '0')) || 0;
    }
    if (dto.recommendations) {
      const { bonus, merit, promotion } = dto.recommendations;
      if (bonus || merit || promotion) {
        if (bonus && sharedRule) {
          await this.db.from('performance_rewards').insert({ perf_eval_id: data.perf_eval_id, reward_type: 'BONUS', amount_value: this.calcRewardAmount(sharedRule, sharedBaseSalary, 'bonus'), is_synced: false });
        }
        if (merit && sharedRule) {
          await this.db.from('performance_rewards').insert({ perf_eval_id: data.perf_eval_id, reward_type: 'MERIT_INCREASE', amount_value: this.calcRewardAmount(sharedRule, sharedBaseSalary, 'merit'), is_synced: false });
        }
        if (promotion) {
          await this.db.from('performance_rewards').insert({ perf_eval_id: data.perf_eval_id, reward_type: 'PROMOTION', amount_value: 0, is_synced: false });
        }
      }
    }
    if (cycleSettings?.auto_compute_bonuses && !(dto.recommendations?.bonus || dto.recommendations?.merit) && sharedRule) {
      const bonusAmt = this.calcRewardAmount(sharedRule, sharedBaseSalary, 'bonus');
      const meritAmt = this.calcRewardAmount(sharedRule, sharedBaseSalary, 'merit');
      if (bonusAmt > 0) await this.db.from('performance_rewards').insert({ perf_eval_id: data.perf_eval_id, reward_type: 'BONUS', amount_value: bonusAmt, is_synced: false });
      if (meritAmt > 0) await this.db.from('performance_rewards').insert({ perf_eval_id: data.perf_eval_id, reward_type: 'MERIT_INCREASE', amount_value: meritAmt, is_synced: false });
    }
    // Get employee name for log
    const { data: emp } = await this.db.from('user_profile').select('first_name, last_name').eq('user_id', dto.user_id).maybeSingle();
    const empName = emp ? `${emp.first_name} ${emp.last_name}` : dto.user_id;
    await this.logActivity({ company_id: companyId, action: `${dto.review_period} Review submitted for ${empName}`, performed_by: reviewerId, actor_role: this.actorRole(reviewerRole), target_user_id: dto.user_id, module_area: dto.review_period === 'MID_YEAR' ? 'MID_YEAR' : 'YEAR_END' });
    return data;
  }

  async submitEvaluation(evalId: string, reviewerId: string, companyId: string) {
    const { data, error } = await this.db.from('performance_evaluations').update({ perf_status: 'Pending by HR' }).eq('perf_eval_id', evalId).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async countersignEvaluation(evalId: string, hrId: string, companyId: string) {
    const { data, error } = await this.db.from('performance_evaluations').update({
      perf_status: 'Approved', countersigned_by: hrId, countersigned_at: new Date().toISOString(),
    }).eq('perf_eval_id', evalId).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async acknowledgeEvaluation(evalId: string, userId: string) {
    const { data, error } = await this.db.from('performance_evaluations').update({ employee_acknowledged_at: new Date().toISOString() }).eq('perf_eval_id', evalId).eq('user_id', userId).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async getEvaluationComments(evalId: string) {
    const { data, error } = await this.db.from('performance_comments').select('*').eq('perf_eval_id', evalId).order('created_at', { ascending: true });
    if (error) throw new BadRequestException(error.message);
    return data || [];
  }

  async addEvaluationComment(evalId: string, userId: string, userRole: string, dto: any) {
    const { data, error } = await this.db.from('performance_comments').insert({
      perf_eval_id: evalId,
      author_id: userId,
      author_role: this.actorRole(userRole),
      comment_text: dto.comment_text,
    }).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // VIOLATIONS
  // ────────────────────────────────────────────────────────────────────────────

  private formatDate(d: string | Date) {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  private getInitials(name: string) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  }

  async getViolations(companyId: string) {
    const { data, error } = await this.db.from('performance_violations').select('*, user_profile(first_name, last_name)')
      .eq('company_id', companyId).order('occured_at', { ascending: false });
    if (error) throw new BadRequestException(error.message);
    return (data || []).map((v: any) => {
      const name = v.user_profile ? `${v.user_profile.first_name} ${v.user_profile.last_name}` : '';
      return { id: v.perf_viol_id, employee: name, type: v.violation_type, severity: v.severity, date: this.formatDate(v.occured_at), avatar: this.getInitials(name) };
    });
  }

  async getViolationsDetailed(companyId: string) {
    const SUGGESTED: Record<string, string> = { LOW: 'Verbal Warning', MEDIUM: 'Written Warning', HIGH: 'Suspension', CRITICAL: 'Escalation / Termination' };
    const { data, error } = await this.db.from('performance_violations').select('*, user_profile(first_name, last_name, employee_id)')
      .eq('company_id', companyId).order('occured_at', { ascending: false });
    if (error) throw new BadRequestException(error.message);
    return (data || []).map((v: any) => {
      const up = v.user_profile || {};
      return {
        id: v.perf_viol_id,
        employeeName: up.first_name && up.last_name ? `${up.first_name} ${up.last_name}` : '',
        employeeId: up.employee_id || '',
        violationType: v.violation_type,
        severity: v.severity ? v.severity.charAt(0) + v.severity.slice(1).toLowerCase() : v.severity,
        description: v.violation_description,
        date: v.occured_at ? new Date(v.occured_at).toISOString().split('T')[0] : '',
        suggestedAction: v.disciplinary_action || SUGGESTED[v.severity] || '',
      };
    });
  }

  async getViolationStats(companyId: string) {
    const { data, error } = await this.db.from('performance_violations').select('severity').eq('company_id', companyId);
    if (error) throw new BadRequestException(error.message);
    const stats: Record<string, number> = { Low: 0, Medium: 0, High: 0, Critical: 0 };
    for (const v of (data || [])) {
      const key = v.severity ? v.severity.charAt(0) + v.severity.slice(1).toLowerCase() : '';
      if (key in stats) stats[key]++;
    }
    return stats;
  }

  async createViolation(loggedBy: string, loggerRole: string, companyId: string, dto: any) {
    const { data, error } = await this.db.from('performance_violations').insert({
      company_id: companyId, user_id: dto.user_id, violation_type: dto.violation_type,
      severity: dto.severity.toUpperCase(), violation_description: dto.description,
      evidence: dto.evidence || '', occured_at: dto.occured_at || new Date().toISOString(),
      logged_by: loggedBy, action_status: 'PENDING',
    }).select().single();
    if (error) throw new BadRequestException(error.message);
    // Run violation rules engine
    const { data: rules } = await this.db.from('performance_violation_rules')
      .select('*').eq('company_id', companyId).eq('is_active', true).eq('severity_threshold', dto.severity.toUpperCase());
    let disciplinaryAction: string | null = null;
    let suggestion = '';
    for (const rule of (rules || [])) {
      const withinClause = rule.within_days ? new Date(Date.now() - rule.within_days * 86400000).toISOString() : null;
      let countQuery = this.db.from('performance_violations').select('perf_viol_id', { count: 'exact' })
        .eq('user_id', dto.user_id).eq('company_id', companyId).eq('severity', dto.severity.toUpperCase());
      if (withinClause) countQuery = countQuery.gte('occured_at', withinClause);
      const { count } = await countQuery;
      if ((count || 0) >= rule.violation_count) {
        disciplinaryAction = rule.resulting_action;
        suggestion = rule.rule_description || `Auto action: ${rule.resulting_action}`;
        await this.db.from('performance_violations').update({ disciplinary_action: rule.resulting_action, action_status: 'PENDING' }).eq('perf_viol_id', data.perf_viol_id);
        break;
      }
    }
    await this.logActivity({ company_id: companyId, action: `Violation logged: ${dto.violation_type}`, performed_by: loggedBy, actor_role: this.actorRole(loggerRole), target_user_id: dto.user_id, module_area: 'VIOLATION' });
    return { id: data.perf_viol_id, disciplinary_action: disciplinaryAction, action_status: 'PENDING', suggestion };
  }

  async patchViolation(violId: string, companyId: string, dto: any) {
    const { data, error } = await this.db.from('performance_violations').update(dto).eq('perf_viol_id', violId).eq('company_id', companyId).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async uploadViolationEvidence(file: Express.Multer.File, companyId: string): Promise<{ url: string }> {
    const ext = file.originalname.split('.').pop() ?? 'bin';
    const path = `${companyId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await this.db.storage
      .from('violation-evidence')
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: false });
    if (error) throw new BadRequestException(error.message);
    const { data: urlData } = this.db.storage.from('violation-evidence').getPublicUrl(path);
    return { url: urlData.publicUrl };
  }

  async uploadPerformanceDocument(file: Express.Multer.File, companyId: string): Promise<{ url: string }> {
    const ext = file.originalname.split('.').pop() ?? 'bin';
    const path = `performance/${companyId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await this.db.storage
      .from('employee-documents')
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: false });
    if (error) throw new BadRequestException(error.message);
    const { data: urlData } = this.db.storage.from('employee-documents').getPublicUrl(path);
    return { url: urlData.publicUrl };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // PIP
  // ────────────────────────────────────────────────────────────────────────────

  async getMyPip(userId: string, companyId: string) {
    const { data, error } = await this.db.from('performance_pip').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw new BadRequestException(error.message);
    return data || [];
  }

  async getTeamPip(managerId: string, companyId: string) {
    const { data: team } = await this.db.from('user_profile').select('user_id').eq('company_id', companyId).neq('user_id', managerId);
    if (!team || team.length === 0) return [];
    const ids = team.map((u: any) => u.user_id);
    const { data, error } = await this.db.from('performance_pip').select('*').in('user_id', ids).order('created_at', { ascending: false });
    if (error) throw new BadRequestException(error.message);
    return data || [];
  }

  async getAllPip(companyId: string) {
    const { data: team } = await this.db.from('user_profile').select('user_id').eq('company_id', companyId);
    if (!team || team.length === 0) return [];
    const ids = team.map((u: any) => u.user_id);
    const { data, error } = await this.db.from('performance_pip').select('*').in('user_id', ids).order('created_at', { ascending: false });
    if (error) throw new BadRequestException(error.message);
    return data || [];
  }

  async getPipById(pipId: string) {
    const { data, error } = await this.db.from('performance_pip').select('*').eq('perf_pip_id', pipId).maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('PIP not found');
    return data;
  }

  async createPip(initiatorId: string, initiatorRole: string, companyId: string, dto: any) {
    const cycle = await this.getActiveCycle(companyId);
    // Check max attempts
    const { data: settings } = await this.db.from('performance_cycle_settings').select('pip_max_attempts').eq('company_id', companyId).maybeSingle();
    const maxAttempts = settings?.pip_max_attempts ?? 2;
    const { count } = await this.db.from('performance_pip').select('perf_pip_id', { count: 'exact' }).eq('user_id', dto.user_id);
    if ((count || 0) >= maxAttempts) throw new BadRequestException(`Maximum PIP attempts (${maxAttempts}) reached for this employee.`);
    const { data, error } = await this.db.from('performance_pip').insert({
      user_id: dto.user_id, perf_eval_id: dto.perf_eval_id || null,
      initiated_by: initiatorId,
      pip_status: 'Pending Approval', attempt_num: (count || 0) + 1,
      deadline: dto.deadline || null, pip_goals: dto.pip_goals || null,
    }).select().single();
    if (error) throw new BadRequestException(error.message);
    const { data: emp } = await this.db.from('user_profile').select('first_name, last_name').eq('user_id', dto.user_id).maybeSingle();
    const empName = emp ? `${emp.first_name} ${emp.last_name}` : dto.user_id;
    await this.logActivity({ company_id: companyId, action: `PIP initiated for ${empName} (attempt ${(count || 0) + 1})`, performed_by: initiatorId, actor_role: this.actorRole(initiatorRole), target_user_id: dto.user_id, module_area: 'PIP' });
    return data;
  }

  async approvePip(pipId: string, approverId: string, companyId: string) {
    const { data, error } = await this.db.from('performance_pip').update({ pip_status: 'In Progress', approved_by: approverId, approved_at: new Date().toISOString() }).eq('perf_pip_id', pipId).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async patchPipStatus(pipId: string, dto: any) {
    const payload = {
      ...dto,
      ...(dto.pip_status ? { pip_status: this.normalizePipStatus(dto.pip_status) } : {}),
    };
    const { data, error } = await this.db.from('performance_pip').update(payload).eq('perf_pip_id', pipId).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async getPipUpdates(pipId: string) {
    const { data, error } = await this.db.from('performance_pip_updates').select('*').eq('perf_pip_id', pipId).order('submitted_date', { ascending: false });
    if (error) throw new BadRequestException(error.message);
    return data || [];
  }

  async createPipUpdate(pipId: string, userId: string, dto: any) {
    const { data, error } = await this.db.from('performance_pip_updates').insert({
      perf_pip_id: pipId, user_id: userId, progress_data: dto.progress_data || [],
      progress_summary: dto.progress_summary || null, milestone_label: dto.milestone_label || null,
      submitted_date: new Date().toISOString(),
    }).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async reviewPipUpdate(updateId: string, reviewerId: string, dto: any) {
    const { data, error } = await this.db.from('performance_pip_updates').update({
      manager_notes: dto.manager_notes || null,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      ...(dto.status ? { status: dto.status } : {}),
    }).eq('pip_update_id', updateId).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // REWARDS
  // ────────────────────────────────────────────────────────────────────────────

  async getRewards(companyId: string) {
    const { data: cycles } = await this.db.from('performance_management_cycle').select('perf_cycle_id').eq('company_id', companyId);
    const cycleIds = (cycles || []).map((c: any) => c.perf_cycle_id);
    if (cycleIds.length === 0) return [];
    const { data: evals } = await this.db.from('performance_evaluations').select('perf_eval_id, user_id, perf_status').in('perf_cycle_id', cycleIds);
    if (!evals || evals.length === 0) return [];
    const evalIds = evals.map((e: any) => e.perf_eval_id);
    const evalMap: Record<string, any> = {};
    for (const e of evals) evalMap[e.perf_eval_id] = e;
    const { data: rewards, error } = await this.db.from('performance_rewards').select('*').in('perf_eval_id', evalIds).order('created_at', { ascending: false });
    if (error) throw new BadRequestException(error.message);
    const uniqueUserIds = [...new Set((rewards || []).map((r: any) => evalMap[r.perf_eval_id]?.user_id).filter(Boolean))];
    const [usersRes, salariesRes] = await Promise.all([
      this.db.from('user_profile').select('user_id, first_name, last_name').in('user_id', uniqueUserIds),
      this.db.from('cnb_salary_baselines').select('user_id, basic_salary, effective_date').in('user_id', uniqueUserIds).order('effective_date', { ascending: false }),
    ]);
    const userNameMap: Record<string, string> = {};
    for (const u of (usersRes.data || [])) userNameMap[u.user_id] = `${u.first_name} ${u.last_name}`;
    const salaryMap: Record<string, number> = {};
    for (const s of (salariesRes.data || [])) {
      if (!salaryMap[s.user_id]) salaryMap[s.user_id] = parseFloat(String(s.basic_salary || '0')) || 0;
    }
    const result: any[] = [];
    for (const r of (rewards || [])) {
      const ev = evalMap[r.perf_eval_id];
      const name = userNameMap[ev.user_id] || '';
      const baseSalaryNum = salaryMap[ev.user_id] || 0;
      const status: string = ev.perf_status === 'Approved' ? (r.is_synced ? 'Pushed' : 'Approved') : 'Pending';
      result.push({
        id: r.perf_rewards_id, employee: name,
        type: r.reward_type === 'BONUS' ? 'Performance Bonus' : r.reward_type === 'MERIT_INCREASE' ? 'Merit Increase' : 'Promotion',
        current: baseSalaryNum > 0 ? `₱${baseSalaryNum.toLocaleString()}/mo` : '—',
        amount: r.amount_value ? `+₱${Number(r.amount_value).toLocaleString()}` : '—',
        status, avatar: this.getInitials(name),
      });
    }
    return result;
  }

  async syncReward(rewardId: string) {
    return this.syncRewardIntoPayroll(rewardId);
  }

  async syncAllRewards(companyId: string) {
    const { data: cycles } = await this.db.from('performance_management_cycle').select('perf_cycle_id').eq('company_id', companyId);
    const cycleIds = (cycles || []).map((c: any) => c.perf_cycle_id);
    if (cycleIds.length === 0) return { message: 'No cycles found' };
    const { data: evals } = await this.db.from('performance_evaluations').select('perf_eval_id').in('perf_cycle_id', cycleIds);
    const evalIds = (evals || []).map((e: any) => e.perf_eval_id);
    if (evalIds.length === 0) return { message: 'No rewards to sync' };
    const { data: rewards, error } = await this.db.from('performance_rewards').select('perf_rewards_id').in('perf_eval_id', evalIds).eq('is_synced', false);
    if (error) throw new BadRequestException(error.message);
    for (const reward of rewards || []) {
      await this.syncRewardIntoPayroll(reward.perf_rewards_id);
    }
    return { message: 'All rewards synced', synced_count: (rewards || []).length };
  }

  async computeBonusRules(companyId: string, userId: string, rating: number) {
    const [ruleRes, salaryRes] = await Promise.all([
      this.db.from('performance_bonus_rules').select('*').eq('company_id', companyId).eq('is_active', true).lte('rating_min', rating).gte('rating_max', rating).maybeSingle(),
      this.db.from('cnb_salary_baselines').select('basic_salary').eq('user_id', userId).order('effective_date', { ascending: false }).limit(1).maybeSingle(),
    ]);
    const rule = ruleRes.data;
    // basic_salary is stored as TEXT in cnb_salary_baselines
    const baseSalary = parseFloat(String(salaryRes.data?.basic_salary || '0')) || 0;
    const bonusAmount = rule ? Math.round(this.calcRewardAmount(rule, baseSalary, 'bonus')) : 0;
    const meritAmount = rule ? Math.round(this.calcRewardAmount(rule, baseSalary, 'merit')) : 0;
    return {
      bonus_amount: bonusAmount,
      merit_amount: meritAmount,
      amount_type: rule?.amount_type || 'percentage',
      bonus_pct: rule?.bonus_pct || 0,
      merit_increase_pct: rule?.merit_increase_pct || 0,
      promotion_eligible: rule?.promotion_eligible || false,
    };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // DASHBOARDS
  // ────────────────────────────────────────────────────────────────────────────

  async getEmployeeDashboard(userId: string, companyId: string) {
    const cycle = await this.getActiveCycle(companyId);
    if (!cycle) return { overall_progress_pct: 0, cycle_stage: 'GOAL_SETTING', active_goals_count: 0, achieved_count: 0, days_to_year_end: 0, midyear_rating: null, midyear_rating_label: null };
    const { data: goals } = await this.db.from('performance_goals').select('progress_pct, status').eq('user_id', userId).eq('perf_cycle_id', cycle.perf_cycle_id);
    const goalList = goals || [];
    const active = goalList.length;
    const achieved = goalList.filter((g: any) => (g.progress_pct || 0) >= 100).length;
    const avgPct = active > 0 ? Math.round(goalList.reduce((s: number, g: any) => s + (g.progress_pct || 0), 0) / active) : 0;
    const { data: evalData } = await this.db.from('performance_evaluations').select('scale_rating, rating_status').eq('user_id', userId).eq('perf_cycle_id', cycle.perf_cycle_id).eq('review_period', 'MID_YEAR').maybeSingle();
    const daysToYearEnd = cycle.end_date ? Math.max(0, Math.ceil((new Date(cycle.end_date).getTime() - Date.now()) / 86400000)) : 0;
    return {
      overall_progress_pct: avgPct, cycle_stage: cycle.status, cycle_name: cycle.cycle_name,
      active_goals_count: active, achieved_count: achieved, days_to_year_end: daysToYearEnd,
      midyear_rating: evalData?.scale_rating || null, midyear_rating_label: evalData?.rating_status || null,
    };
  }

  async getManagerDashboard(managerId: string, companyId: string) {
    const cycle = await this.getActiveCycle(companyId);
    const { data: team } = await this.db.from('user_profile').select('user_id').eq('company_id', companyId).neq('user_id', managerId);
    const teamList = team || [];
    const teamCount = teamList.length;
    if (teamCount === 0) return { team_count: 0, team_avg_rating: 0, on_track_count: 0, at_risk_count: 0, active_pip_count: 0, exceeding_count: 0 };
    const ids = teamList.map((u: any) => u.user_id);
    const [evalRes, pipRes, goalsRes] = await Promise.all([
      cycle ? this.db.from('performance_evaluations').select('user_id, scale_rating').in('user_id', ids).eq('perf_cycle_id', cycle.perf_cycle_id).eq('review_period', 'MID_YEAR') : { data: [] },
      this.db.from('performance_pip').select('user_id').in('user_id', ids).eq('pip_status', 'In Progress'),
      cycle ? this.db.from('performance_goals').select('user_id, progress_pct').in('user_id', ids).eq('perf_cycle_id', cycle.perf_cycle_id) : { data: [] },
    ]);
    const evals = evalRes.data || [];
    const pips = pipRes.data || [];
    const goalsList = goalsRes.data || [];
    const pipUsers = new Set(pips.map((p: any) => p.user_id));
    const avgRatings: Record<string, number[]> = {};
    for (const e of evals) {
      if (!avgRatings[e.user_id]) avgRatings[e.user_id] = [];
      avgRatings[e.user_id].push(e.scale_rating);
    }
    const avgProgress: Record<string, number[]> = {};
    for (const g of goalsList) {
      if (!avgProgress[g.user_id]) avgProgress[g.user_id] = [];
      avgProgress[g.user_id].push(g.progress_pct || 0);
    }
    let onTrack = 0, atRisk = 0, exceeding = 0;
    for (const u of ids) {
      if (pipUsers.has(u)) continue;
      const ratings = avgRatings[u] || [];
      const avgRating = ratings.length > 0 ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : 0;
      const progs = avgProgress[u] || [];
      const avgProg = progs.length > 0 ? progs.reduce((a: number, b: number) => a + b, 0) / progs.length : 0;
      if (avgRating >= 4.5) exceeding++;
      else if (avgProg < 40) atRisk++;
      else onTrack++;
    }
    const allRatings = evals.map((e: any) => e.scale_rating);
    const teamAvg = allRatings.length > 0 ? +(allRatings.reduce((a: number, b: number) => a + b, 0) / allRatings.length).toFixed(1) : 0;
    return { team_count: teamCount, team_avg_rating: teamAvg, on_track_count: onTrack, at_risk_count: atRisk, active_pip_count: pips.length, exceeding_count: exceeding, cycle_name: cycle?.cycle_name ?? null, cycle_stage: cycle?.status ?? null };
  }

  async getManagerTeam(managerId: string, companyId: string) {
    const cycle = await this.getActiveCycle(companyId);
    const { data: team } = await this.db.from('user_profile').select('user_id, first_name, last_name, employee_id, role_id').eq('company_id', companyId).neq('user_id', managerId).in('account_status', ['Active', 'Pending']);
    const members = team || [];
    const result: any[] = [];
    for (const m of members) {
      const name = `${m.first_name} ${m.last_name}`;
      const [goalsRes, evalRes, pipRes] = await Promise.all([
        cycle ? this.db.from('performance_goals').select('progress_pct, status').eq('user_id', m.user_id).eq('perf_cycle_id', cycle.perf_cycle_id) : { data: [] },
        cycle ? this.db.from('performance_evaluations').select('scale_rating').eq('user_id', m.user_id).eq('perf_cycle_id', cycle.perf_cycle_id).eq('review_period', 'MID_YEAR').maybeSingle() : { data: null },
        this.db.from('performance_pip').select('pip_status').eq('user_id', m.user_id).eq('pip_status', 'In Progress').maybeSingle(),
      ]);
      const goalList = goalsRes.data || [];
      const goals = goalList.length;
      const achieved = goalList.filter((g: any) => (g.progress_pct || 0) >= 100).length;
      const rating = evalRes.data?.scale_rating ? String(evalRes.data.scale_rating) : '—';
      const hasPip = !!pipRes.data;
      const avgProg = goals > 0 ? goalList.reduce((s: number, g: any) => s + (g.progress_pct || 0), 0) / goals : 0;
      let status = 'On Track';
      if (hasPip) status = 'PIP';
      else if (evalRes.data?.scale_rating >= 4.5) status = 'Exceeding';
      else if (avgProg < 40) status = 'At Risk';
      const stage = hasPip ? 'PIP Active' : cycle ? (cycle.status === 'MID_YEAR' ? 'Mid-Year Review' : cycle.status) : '—';
      result.push({ id: m.user_id, name, role: m.role_id || '', stage, goals, achieved, rating, status, avatar: this.getInitials(name) });
    }
    return result;
  }

  async getHrDashboard(companyId: string) {
    const [usersRes, cyclesRes, violRes] = await Promise.all([
      this.db.from('user_profile').select('user_id').eq('company_id', companyId).eq('account_status', 'Active'),
      this.db.from('performance_management_cycle').select('perf_cycle_id, cycle_name').eq('company_id', companyId),
      this.db.from('performance_violations').select('perf_viol_id', { count: 'exact' }).eq('company_id', companyId),
    ]);
    const cycleIds = (cyclesRes.data || []).map((c: any) => c.perf_cycle_id);
    let pending = 0;
    let evalIds: string[] = [];
    if (cycleIds.length > 0) {
      const [goalsRes, evalRes] = await Promise.all([
        this.db.from('performance_goals').select('perf_goals_id', { count: 'exact' }).in('perf_cycle_id', cycleIds).eq('status', 'PENDING_APPROVAL'),
        this.db.from('performance_evaluations').select('perf_eval_id').in('perf_cycle_id', cycleIds).eq('perf_status', 'Pending by HR'),
      ]);
      evalIds = (evalRes.data || []).map((e: any) => e.perf_eval_id);
      const pipRes = evalIds.length > 0
        ? await this.db.from('performance_pip').select('perf_pip_id', { count: 'exact' }).in('perf_eval_id', evalIds).eq('pip_status', 'Pending Approval')
        : { count: 0 };
      pending = (goalsRes.count || 0) + (evalRes.data?.length || 0) + (pipRes.count || 0);
    }
    const rewards = evalIds.length > 0
      ? (await this.db.from('performance_rewards').select('amount_value, is_synced').in('perf_eval_id', evalIds)).data || []
      : [];
    const unsyncedRewards = rewards.filter((r: any) => !r.is_synced);
    const bonusTotal = unsyncedRewards.reduce((s: number, r: any) => s + (parseFloat(String(r.amount_value || '0')) || 0), 0);
    // Pass rate: scoped to company's cycles
    let passRate = 0;
    if (evalIds.length > 0) {
      const passRes = await this.db.from('performance_evaluations').select('rating_status').in('perf_eval_id', evalIds).eq('perf_status', 'Approved');
      const allEvals = passRes.data || [];
      passRate = allEvals.length > 0 ? Math.round(allEvals.filter((e: any) => e.rating_status === 'PASS').length / allEvals.length * 100) : 0;
    }
    const activeCycle = (cyclesRes.data || []).find((c: any) => c.cycle_name) || cyclesRes.data?.[0];
    return { total_employees: usersRes.data?.length || 0, pending_count: pending, violation_count: violRes.count || 0, bonuses_pending_amount: bonusTotal, bonuses_pending_count: unsyncedRewards.length, pass_rate: passRate, cycle_name: activeCycle?.cycle_name || null };
  }

  async getHrApprovals(companyId: string, tab?: string) {
    const cycle = await this.getActiveCycle(companyId);
    const { data: companyUsers } = await this.db.from('user_profile').select('user_id, first_name, last_name').eq('company_id', companyId);
    const userIds = (companyUsers || []).map((u: any) => u.user_id);
    const userNameMap: Record<string, string> = {};
    for (const u of (companyUsers || [])) userNameMap[u.user_id] = `${u.first_name} ${u.last_name}`;
    const lookupName = (id: string) => userNameMap[id] || '';
    const items: any[] = [];
    const tabLower = (tab || 'all').toLowerCase();
    if (['all', 'goals'].includes(tabLower) && cycle) {
      const { data: goals } = await this.db.from('performance_goals').select('*').eq('status', 'PENDING_APPROVAL').in('user_id', userIds);
      for (const g of (goals || [])) {
        const ago = g.created_at ? Math.round((Date.now() - new Date(g.created_at).getTime()) / 3600000) + ' hours ago' : '';
        items.push({ id: g.perf_goals_id, type: 'Goal', title: g.goal_name || 'Goal Approval', employee: lookupName(g.user_id), metadata: `${g.bsc_category || 'BSC'} • Set by ${lookupName(g.set_by)} • ${ago} • Target: ${g.target_value || '—'} • Priority: ${g.priority || '—'}`, status: 'Pending', icon: '🎯' });
      }
    }
    if (['all', 'reviews'].includes(tabLower)) {
      const { data: evals } = await this.db.from('performance_evaluations').select('*').eq('perf_status', 'Pending by HR').in('user_id', userIds);
      for (const e of (evals || [])) {
        const ago = e.created_at ? Math.round((Date.now() - new Date(e.created_at).getTime()) / 3600000) + ' hours ago' : '';
        items.push({ id: e.perf_eval_id, type: 'Review', title: 'Review Countersign', employee: lookupName(e.user_id), metadata: `Submitted by ${lookupName(e.review_by)} • ${ago}`, status: 'Pending', icon: '📋' });
      }
    }
    if (['all', 'pips'].includes(tabLower)) {
      const { data: pips } = await this.db.from('performance_pip').select('*').eq('pip_status', 'Pending Approval').in('user_id', userIds);
      for (const p of (pips || [])) {
        const ago = p.created_at ? Math.round((Date.now() - new Date(p.created_at).getTime()) / 3600000) + ' hours ago' : '';
        items.push({ id: p.perf_pip_id, type: 'PIP', title: 'PIP Approval', employee: lookupName(p.user_id), metadata: `Initiated by ${lookupName(p.initiated_by)} • ${ago}`, status: 'Pending', icon: '⚠️' });
      }
    }
    if (['all', 'bonuses'].includes(tabLower)) {
      const { data: cycles } = await this.db.from('performance_management_cycle').select('perf_cycle_id').eq('company_id', companyId);
      const cycleIds = (cycles || []).map((c: any) => c.perf_cycle_id);
      if (cycleIds.length > 0) {
        const { data: evals } = await this.db.from('performance_evaluations').select('perf_eval_id, user_id').in('perf_cycle_id', cycleIds);
        const evalIds = (evals || []).map((e: any) => e.perf_eval_id);
        if (evalIds.length > 0) {
          const evalUserMap: Record<string, string> = {};
          for (const e of (evals || [])) evalUserMap[e.perf_eval_id] = e.user_id;
          const { data: rewards } = await this.db.from('performance_rewards').select('*').in('perf_eval_id', evalIds).eq('is_synced', false);
          for (const r of (rewards || [])) {
            items.push({ id: r.perf_rewards_id, type: r.reward_type === 'PROMOTION' ? 'Promotion' : 'Bonus', title: r.reward_type === 'BONUS' ? 'Performance Bonus' : r.reward_type === 'MERIT_INCREASE' ? 'Merit Increase' : 'Promotion', employee: lookupName(evalUserMap[r.perf_eval_id]), metadata: `₱${Number(r.amount_value || 0).toLocaleString()} pending`, status: 'Pending', icon: r.reward_type === 'PROMOTION' ? '📈' : '💰' });
          }
        }
      }
    }
    return items;
  }

  async approveHrItem(itemId: string, approverId: string, dto: any) {
    const type = dto.type;
    if (type === 'Goal') {
      const { data, error } = await this.db.from('performance_goals').update({ status: 'APPROVED', approved_by: approverId, approved_at: new Date().toISOString() }).eq('perf_goals_id', itemId).select().single();
      if (error) throw new BadRequestException(error.message);
      return data;
    } else if (type === 'Review') {
      const { data, error } = await this.db.from('performance_evaluations').update({ perf_status: 'Approved', countersigned_by: approverId, countersigned_at: new Date().toISOString(), ...(dto.document_url && { document_url: dto.document_url }) }).eq('perf_eval_id', itemId).select().single();
      if (error) throw new BadRequestException(error.message);
      return data;
    } else if (type === 'PIP') {
      const { data, error } = await this.db.from('performance_pip').update({ pip_status: 'In Progress', approved_by: approverId, approved_at: new Date().toISOString(), ...(dto.document_url && { document_url: dto.document_url }) }).eq('perf_pip_id', itemId).select().single();
      if (error) throw new BadRequestException(error.message);
      return data;
    } else if (type === 'Bonus' || type === 'Promotion') {
      return this.syncRewardIntoPayroll(itemId);
    }
    throw new BadRequestException(`Unknown approval type: ${type}`);
  }

  async reviewHrItem(itemId: string, approverId: string, dto: any) {
    if (dto.action === 'Confirm' || dto.action === 'Approve') {
      return this.approveHrItem(itemId, approverId, dto);
    }
    // Reject
    const type = dto.type;
    if (type === 'Goal') {
      const { data, error } = await this.db.from('performance_goals').update({ status: 'REJECTED', rejected_reason: dto.comment || null }).eq('perf_goals_id', itemId).select().single();
      if (error) throw new BadRequestException(error.message);
      return data;
    } else if (type === 'Review') {
      const { data, error } = await this.db.from('performance_evaluations').update({ perf_status: 'Rejected' }).eq('perf_eval_id', itemId).select().single();
      if (error) throw new BadRequestException(error.message);
      return data;
    } else if (type === 'PIP') {
      const { data, error } = await this.db.from('performance_pip').update({ pip_status: 'Rejected' }).eq('perf_pip_id', itemId).select().single();
      if (error) throw new BadRequestException(error.message);
      return data;
    }
    throw new BadRequestException('Reject action not supported for this type');
  }

  async getActivityLogs(companyId: string, page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const { data, error, count } = await this.db.from('performance_activity_logs').select('*', { count: 'exact' }).eq('company_id', companyId).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    if (error) throw new BadRequestException(error.message);
    return { data: data || [], total: count || 0, page, limit };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SELF-ASSESSMENTS
  // ────────────────────────────────────────────────────────────────────────────

  async getMySelfAssessment(userId: string, companyId: string) {
    const cycle = await this.getActiveCycle(companyId);
    if (!cycle) return null;
    const { data, error } = await this.db.from('performance_self_assessments')
      .select('*').eq('user_id', userId).eq('perf_cycle_id', cycle.perf_cycle_id).maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async createOrUpdateSelfAssessment(userId: string, companyId: string, dto: any) {
    const cycle = await this.getActiveCycle(companyId);
    if (!cycle) throw new BadRequestException('No active performance cycle');
    const existing = await this.getMySelfAssessment(userId, companyId);
    const payload = {
      goal_results: dto.goal_results ?? [],
      self_comments: dto.self_comments || null,
      status: 'SUBMITTED',
      submitted_at: new Date().toISOString(),
    };
    if (existing) {
      const { data, error } = await this.db.from('performance_self_assessments')
        .update(payload).eq('self_assessment_id', existing.self_assessment_id).select().single();
      if (error) throw new BadRequestException(error.message);
      return data;
    }
    const { data, error } = await this.db.from('performance_self_assessments')
      .insert({ user_id: userId, perf_cycle_id: cycle.perf_cycle_id, ...payload }).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async getSelfAssessmentByUser(targetUserId: string, companyId: string) {
    const cycle = await this.getActiveCycle(companyId);
    if (!cycle) return null;
    const { data, error } = await this.db.from('performance_self_assessments')
      .select('*').eq('user_id', targetUserId).eq('perf_cycle_id', cycle.perf_cycle_id).maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // RATING LABELS
  // ────────────────────────────────────────────────────────────────────────────

  async getRatingLabels(companyId: string) {
    const { data } = await this.db.from('performance_cycle_settings')
      .select('rating_label_1, rating_label_2, rating_label_3, rating_label_4, rating_label_5')
      .eq('company_id', companyId).maybeSingle();
    if (!data) return ['Below Exp.', 'Below Exp.', 'Meets Exp.', 'Above Avg.', 'Excellent'];
    return [data.rating_label_1, data.rating_label_2, data.rating_label_3, data.rating_label_4, data.rating_label_5];
  }
}
