import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { DatabaseErrorHandler } from '../common/database-error.handler';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CnbService } from '../cnb/cnb.service';
import { CnbEncryptionService } from '../cnb/cnb-encryption.service';
import { CreateOffboardingCaseDto } from './dto/create-case.dto';
import { UpdateKnowledgeTransferDto } from './dto/update-knowledge-transfer.dto';
import { UpdateFinalPayDto } from './dto/update-final-pay.dto';
import { ConfigureChecklistTemplateDto } from './dto/configure-checklist-template.dto';

export function buildVacatedPositionTitle(input: {
  specificPositionTitle?: string | null;
  firstName: string;
  lastName: string;
}): string {
  const specificPositionTitle = input.specificPositionTitle?.trim();
  if (specificPositionTitle) {
    return `${specificPositionTitle} (Vacated Position)`;
  }
  return `Vacated Position (${input.firstName} ${input.lastName})`;
}

@Injectable()
export class OffboardingService {
  private readonly logger = new Logger(OffboardingService.name);
  private readonly defaultSystemAccessOptions = [
    'Email',
    'HRIS System',
    'Timekeeping System',
  ] as const;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly cnbService: CnbService,
    private readonly encryption: CnbEncryptionService,
  ) {}

  private roundCurrency(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private decryptPayslipFields<T extends Record<string, unknown>>(row: T): T {
    const fields = [
      'basic_pay_earned', 'total_allowances', 'gross_pay',
      'tax_deduction', 'statutory_deductions', 'total_deductions', 'net_pay',
    ];
    const result = { ...row };
    for (const f of fields) {
      if (result[f] != null) {
        (result as Record<string, unknown>)[f] = this.encryption.decrypt(String(result[f]));
      }
    }
    return result;
  }

  private parsePayslipMetadata(value: unknown): Record<string, unknown> | null {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  private isSettlementPayslipForCase(
    row: Record<string, unknown>,
    caseId: string,
  ): boolean {
    const metadata = this.parsePayslipMetadata(row.other_deductions);
    return metadata?.settlement_case_id === caseId;
  }

  private isOffboardingSettlementPayslip(row: Record<string, unknown>): boolean {
    const metadata = this.parsePayslipMetadata(row.other_deductions);
    return metadata?.settlement_type === 'offboarding_final_pay';
  }

  private async findSettlementPayslips(companyId: string, caseId: string) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('cnb_payslips')
      .select('payslip_id, other_deductions')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(25);

    if (error) {
      DatabaseErrorHandler.handle(error, 'findSettlementPayslips', this.logger);
    }

    return (data ?? []).filter((row) =>
      this.isSettlementPayslipForCase(row as Record<string, unknown>, caseId),
    );
  }

  private async updateSettlementPayslipStatus(
    companyId: string,
    caseId: string,
    status: 'Final Pay' | 'Transfer Confirmed',
  ) {
    const supabase = this.supabaseService.getClient();
    const payslips = await this.findSettlementPayslips(companyId, caseId);
    const payslipIds = payslips.map((row) => String(row.payslip_id ?? '')).filter(Boolean);
    if (payslipIds.length === 0) return;

    const { error } = await supabase
      .from('cnb_payslips')
      .update({ status })
      .in('payslip_id', payslipIds);

    if (error) {
      DatabaseErrorHandler.handle(error, 'updateSettlementPayslipStatus', this.logger);
    }
  }

  private async getFinalSettlementPayslip(caseId: string, companyId: string) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('cnb_payslips')
      .select(
        'payslip_id, basic_pay_earned, total_allowances, gross_pay, tax_deduction, statutory_deductions, total_deductions, net_pay, status, employee_ack_status, created_at, other_deductions, period:period_id(period_id, cutoff_start_date, cutoff_end_date, payout_date, status)',
      )
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(25);

    if (error) {
      DatabaseErrorHandler.handle(error, 'getFinalSettlementPayslip', this.logger);
    }
    const settlementPayslip = (data ?? []).find((row) =>
      this.isSettlementPayslipForCase(row as Record<string, unknown>, caseId),
    );
    if (!settlementPayslip) return null;
    return this.decryptPayslipFields(settlementPayslip);
  }

  private async ensureFinalSettlementPeriod(
    caseId: string,
    companyId: string,
    lastWorkingDay: string,
    processedBy: string,
  ) {
    const supabase = this.supabaseService.getClient();
    const { data: existing, error: existingError } = await supabase
      .from('cnb_payroll_periods')
      .select('period_id')
      .eq('company_id', companyId)
      .eq('payout_date', lastWorkingDay)
      .eq('status', 'Final Settlement')
      .maybeSingle();

    if (existingError) {
      DatabaseErrorHandler.handle(existingError, 'ensureFinalSettlementPeriod', this.logger);
    }
    if (existing) return existing.period_id;

    const { data, error } = await supabase
      .from('cnb_payroll_periods')
      .insert({
        period_id: crypto.randomUUID(),
        company_id: companyId,
        cutoff_start_date: lastWorkingDay,
        cutoff_end_date: lastWorkingDay,
        payout_date: lastWorkingDay,
        status: 'Final Settlement',
        processed_by: processedBy,
        processed_at: new Date().toISOString(),
      })
      .select('period_id')
      .single();

    if (error) {
      DatabaseErrorHandler.handle(error, 'ensureFinalSettlementPeriod', this.logger);
    }
    if (!data) {
      throw new BadRequestException('Failed to create final settlement period');
    }
    return data.period_id;
  }

  private async syncFinalSettlementPayslip(input: {
    caseId: string;
    companyId: string;
    employeeId: string;
    actorId: string;
    lastWorkingDay: string;
    finalPay: {
      salary_balance: number;
      leave_encashment: number;
      additional_pay: number;
      tax_deduction: number;
      statutory_deductions: number;
      deductions: number;
      total_amount: number;
      status: string;
    };
    breakdown?: Record<string, unknown>;
  }) {
    const supabase = this.supabaseService.getClient();
    const periodId = await this.ensureFinalSettlementPeriod(
      input.caseId,
      input.companyId,
      input.lastWorkingDay,
      input.actorId,
    );

    const enc = (n: number) => this.encryption.encryptNumber(this.roundCurrency(n));

    const otherDeductionDetails = {
      settlement_case_id: input.caseId,
      settlement_type: 'offboarding_final_pay',
      leave_encashment: this.roundCurrency(input.finalPay.leave_encashment),
      additional_pay: this.roundCurrency(input.finalPay.additional_pay),
      tax_deduction: this.roundCurrency(input.finalPay.tax_deduction),
      statutory_deductions: this.roundCurrency(input.finalPay.statutory_deductions),
    };
    const otherDeductions = JSON.stringify(
      input.breakdown
        ? { ...otherDeductionDetails, ...input.breakdown }
        : otherDeductionDetails,
    );

    const grossPay =
      input.finalPay.salary_balance +
      input.finalPay.leave_encashment +
      input.finalPay.additional_pay;

    const payslipPayload = {
      period_id: periodId,
      user_id: input.employeeId,
      company_id: input.companyId,
      basic_pay_earned: enc(input.finalPay.salary_balance),
      total_allowances: enc(input.finalPay.leave_encashment + input.finalPay.additional_pay),
      gross_pay: enc(grossPay),
      tax_deduction: enc(input.finalPay.tax_deduction),
      statutory_deductions: enc(input.finalPay.statutory_deductions),
      other_deductions: otherDeductions,
      total_deductions: enc(input.finalPay.deductions),
      net_pay: enc(input.finalPay.total_amount),
      status: input.finalPay.status === 'Transfer Confirmed' ? 'Transfer Confirmed' : 'Final Pay',
      employee_ack_status: 'Pending',
    };

    const { data: existing, error: existingError } = await supabase
      .from('cnb_payslips')
      .select('payslip_id, employee_ack_status, acknowledged_at')
      .eq('period_id', periodId)
      .eq('user_id', input.employeeId)
      .maybeSingle();
    if (existingError) {
      DatabaseErrorHandler.handle(existingError, 'syncFinalSettlementPayslip', this.logger);
    }

    const query = existing
      ? supabase
          .from('cnb_payslips')
          .update({
            ...payslipPayload,
            employee_ack_status: existing.employee_ack_status ?? 'Pending',
            acknowledged_at: existing.acknowledged_at ?? null,
          })
          .eq('payslip_id', existing.payslip_id)
      : supabase
          .from('cnb_payslips')
          .insert({
            payslip_id: crypto.randomUUID(),
            ...payslipPayload,
          });

    const { data, error } = await query.select('*').single();
    if (error) {
      DatabaseErrorHandler.handle(error, 'syncFinalSettlementPayslip', this.logger);
    }
    return data;
  }

  private async getLinkedPayrollReference(
    employeeId: string,
    companyId: string,
    lastWorkingDay?: string | null,
  ) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('cnb_payslips')
      .select(
        'payslip_id, net_pay, gross_pay, total_deductions, created_at, status, other_deductions, period:period_id(period_id, cutoff_start_date, cutoff_end_date, payout_date)',
      )
      .eq('user_id', employeeId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(25);
    if (error) {
      DatabaseErrorHandler.handle(error, 'getLinkedPayrollReference', this.logger);
    }
    const linkedPayroll = data?.find(
      (row) => !this.isOffboardingSettlementPayslip(row as Record<string, unknown>),
    );
    if (!linkedPayroll) return null;
    return this.decryptPayslipFields(linkedPayroll);
  }

  private async recomputeFinalPayFromCompensation(caseId: string) {
    const supabase = this.supabaseService.getClient();
    const { data: offboardingCase } = await supabase
      .from('offboarding_cases')
      .select('case_id, employee_id, initiated_by_id, last_working_day')
      .eq('case_id', caseId)
      .maybeSingle();

    if (!offboardingCase) {
      throw new NotFoundException('Offboarding case not found.');
    }

    const { data: employee } = await supabase
      .from('user_profile')
      .select('company_id')
      .eq('user_id', (offboardingCase as any).employee_id)
      .maybeSingle();

    const companyId = (employee as any)?.company_id;
    if (!companyId) {
      throw new BadRequestException('Employee company context is missing.');
    }
    if (!(offboardingCase as any).last_working_day) {
      throw new BadRequestException('Last working day is required before computing final pay.');
    }

    const computed = await this.cnbService.computeOffboardingFinalPay(
      (offboardingCase as any).employee_id,
      companyId,
      (offboardingCase as any).last_working_day,
    );

    const updatePayload = {
      salary_balance: computed.salary_balance,
      leave_encashment: computed.leave_encashment,
      additional_pay: computed.additional_pay,
      deductions: computed.deductions,
      total_amount: computed.total_amount,
      status: 'Ready for Review',
    };

    // final_pay.case_id has no UNIQUE constraint so upsert(onConflict) is unreliable.
    // Use explicit SELECT → UPDATE or INSERT to avoid duplicate rows.
    const existingRows = await this.listFinalPayRecords(caseId);

    let data: Record<string, unknown> | null = null;
    if (existingRows.length > 0) {
      const { data: updatedRows, error } = await supabase
        .from('final_pay')
        .update(updatePayload)
        .eq('case_id', caseId)
        .select('*');
      if (error) DatabaseErrorHandler.handle(error, 'recomputeFinalPayFromCompensation-update', this.logger);
      data = this.pickCurrentFinalPay(updatedRows as Record<string, unknown>[] | null);
    } else {
      const { data: inserted, error } = await supabase
        .from('final_pay')
        .insert({ case_id: caseId, ...updatePayload })
        .select('*')
        .single();
      if (error) DatabaseErrorHandler.handle(error, 'recomputeFinalPayFromCompensation-insert', this.logger);
      data = inserted as Record<string, unknown>;
    }

    // Payslip sync is best-effort — a failure here must not prevent returning
    // the final pay data which is already written to the final_pay table.
    let settlement_payslip: unknown = null;
    try {
      settlement_payslip = await this.syncFinalSettlementPayslip({
        caseId,
        companyId,
        employeeId: (offboardingCase as any).employee_id,
        actorId: (offboardingCase as any).initiated_by_id ?? (offboardingCase as any).employee_id,
        lastWorkingDay: (offboardingCase as any).last_working_day,
        finalPay: {
          salary_balance: computed.salary_balance,
          leave_encashment: computed.leave_encashment,
          additional_pay: computed.additional_pay,
          tax_deduction: computed.breakdown.tax,
          statutory_deductions: computed.breakdown.statutory.total,
          deductions: computed.deductions,
          total_amount: computed.total_amount,
          status: 'Ready for Review',
        },
        breakdown: computed.breakdown as Record<string, unknown>,
      });
    } catch (syncErr) {
      this.logger.warn(
        `Final pay computed but payslip sync failed for case ${caseId}: ${(syncErr as Error)?.message ?? syncErr}`,
      );
    }

    return {
      ...(data as any),
      computed_breakdown: computed.breakdown,
      settlement_payslip,
    };
  }

  // =========================================================
  // SYSTEM ADMIN — Tenant module + role permissions
  // =========================================================

  async enableOffboardingModule(companyId: string, performedBy: string) {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('tenant_modules')
      .upsert({ company_id: companyId, module_name: 'offboarding', status: 'Active' },
        { onConflict: 'company_id,module_name' });
    if (error) {
      DatabaseErrorHandler.handle(error, 'enableOffboardingModule', this.logger);
    }

    this.auditService.log(`OFFBOARDING_MODULE_ENABLED for company ${companyId}`, performedBy, companyId)
      .catch(err => this.logger.error('Audit failed in enableOffboardingModule', err));

    return { message: 'Offboarding module enabled', company_id: companyId, status: 'Active' };
  }

  async disableOffboardingModule(companyId: string, performedBy: string) {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('tenant_modules')
      .upsert({ company_id: companyId, module_name: 'offboarding', status: 'Inactive' },
        { onConflict: 'company_id,module_name' });
    if (error) {
      DatabaseErrorHandler.handle(error, 'disableOffboardingModule', this.logger);
    }

    this.auditService.log(`OFFBOARDING_MODULE_DISABLED for company ${companyId}`, performedBy, companyId)
      .catch(err => this.logger.error('Audit failed in disableOffboardingModule', err));

    return { message: 'Offboarding module disabled', company_id: companyId, status: 'Inactive' };
  }

  async getOffboardingAuditLogs(filters?: { company_id?: string; employee_id?: string }) {
    const supabase = this.supabaseService.getClient();
    let query = supabase
      .from('admin_audit_logs')
      .select('*, performer:user_profile!admin_audit_logs_performed_by_fkey(first_name, last_name)')
      .ilike('action', 'OFFBOARDING%')
      .order('timestamp', { ascending: false })
      .limit(100);

    if (filters?.company_id) query = (query as any).eq('company_id', filters.company_id);
    if (filters?.employee_id) query = (query as any).eq('target_user_id', filters.employee_id);

    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  // =========================================================
  // HR — Checklist Template Configuration (Phase 1)
  // =========================================================

  async configureChecklistTemplate(dto: ConfigureChecklistTemplateDto, companyId: string, hrUserId: string) {
    const supabase = this.supabaseService.getClient();
    const templateId = crypto.randomUUID();
    const applicableTypes = [...new Set((dto.applicable_offboarding_types ?? []).filter(Boolean))];
    const systemAccessToRevoke = [...new Set(
      (dto.system_access_to_revoke ?? [])
        .map((value) => String(value).trim())
        .filter((value) => value.length > 0),
    )];

    const { data: template, error: tErr } = await supabase
      .from('offboarding_checklist_templates')
      .insert({
        template_id: templateId,
        company_id: companyId,
        template_name: dto.template_name,
        employee_type: dto.employee_type ?? null,
        description: dto.description ?? null,
        applicable_offboarding_types: applicableTypes,
        is_default: dto.is_default ?? false,
        require_knowledge_transfer: dto.require_knowledge_transfer ?? true,
        system_access_to_revoke: systemAccessToRevoke,
        created_by: hrUserId,
      })
      .select().single();
    if (tErr) throw new BadRequestException(tErr.message);

    if (dto.items?.length > 0) {
      const rows = dto.items.map(item => ({
        item_id: crypto.randomUUID(),
        template_id: templateId,
        item_name: item.item_name,
        description: item.description ?? null,
        is_required: item.is_required,
        category: item.category ?? null,     // GAP-7.1 FIX
        is_custom: item.is_custom ?? false,  // GAP-7.1 FIX
      }));
      const { error: iErr } = await supabase.from('offboarding_checklist_template_items').insert(rows);
      if (iErr) {
        DatabaseErrorHandler.handle(iErr, 'configureChecklistTemplate', this.logger);
      }
    }

    this.auditService.log(`OFFBOARDING_TEMPLATE_CREATED: ${dto.template_name}`, hrUserId, companyId)
      .catch(err => this.logger.error('Audit failed in configureChecklistTemplate', err));

    return { ...template, items: dto.items };
  }

  async getChecklistTemplates(companyId: string) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('offboarding_checklist_templates')
      .select('*, offboarding_checklist_template_items(*)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (error) {
      DatabaseErrorHandler.handle(error, 'getChecklistTemplates', this.logger);
    }
    return data ?? [];
  }

  async getSystemAccessOptions(companyId: string): Promise<string[]> {
    const supabase = this.supabaseService.getClient();
    const options = new Set<string>(this.defaultSystemAccessOptions);

    const { data: templates, error: templateError } = await supabase
      .from('offboarding_checklist_templates')
      .select('system_access_to_revoke')
      .eq('company_id', companyId);
    if (templateError) {
      DatabaseErrorHandler.handle(templateError, 'getSystemAccessOptions.templates', this.logger);
    }

    for (const template of templates ?? []) {
      const configuredSystems = Array.isArray((template as any)?.system_access_to_revoke)
        ? ((template as any).system_access_to_revoke as unknown[])
        : [];
      for (const value of configuredSystems) {
        const normalized = String(value ?? '').trim();
        if (normalized) options.add(normalized);
      }
    }

    const { data: companyEmployees, error: employeeError } = await supabase
      .from('user_profile')
      .select('user_id')
      .eq('company_id', companyId);
    if (employeeError) {
      DatabaseErrorHandler.handle(employeeError, 'getSystemAccessOptions.companyEmployees', this.logger);
    }

    const employeeIds = (companyEmployees ?? [])
      .map((row: any) => String(row.user_id ?? '').trim())
      .filter(Boolean);

    if (employeeIds.length > 0) {
      const { data: companyCases, error: caseError } = await supabase
        .from('offboarding_cases')
        .select('case_id')
        .in('employee_id', employeeIds);
      if (caseError) {
        DatabaseErrorHandler.handle(caseError, 'getSystemAccessOptions.cases', this.logger);
      }

      const caseIds = (companyCases ?? [])
        .map((row: any) => String(row.case_id ?? '').trim())
        .filter(Boolean);

      if (caseIds.length === 0) {
        return [...options].sort((a, b) => a.localeCompare(b));
      }

      const { data: systemRows, error: systemError } = await supabase
        .from('system_access')
        .select('system_name')
        .in('case_id', caseIds);
      if (systemError) {
        DatabaseErrorHandler.handle(systemError, 'getSystemAccessOptions.system_access', this.logger);
      }

      for (const row of systemRows ?? []) {
        const normalized = String((row as any)?.system_name ?? '').trim();
        if (normalized) options.add(normalized);
      }
    }

    return [...options].sort((a, b) => a.localeCompare(b));
  }

  async updateChecklistTemplate(
    templateId: string,
    dto: ConfigureChecklistTemplateDto,
    companyId: string,
    actorUserId: string,
  ) {
    const supabase = this.supabaseService.getClient();

    const { data: existing, error: findErr } = await supabase
      .from('offboarding_checklist_templates')
      .select('template_id, company_id')
      .eq('template_id', templateId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (findErr) throw new BadRequestException(findErr.message);
    if (!existing) throw new NotFoundException('Checklist template not found.');

    const { data: updatedTemplate, error: updateErr } = await supabase
      .from('offboarding_checklist_templates')
      .update({
        template_name: dto.template_name,
        employee_type: dto.employee_type ?? null,
        description: dto.description ?? null,
        applicable_offboarding_types: [...new Set((dto.applicable_offboarding_types ?? []).filter(Boolean))],
        is_default: dto.is_default ?? false,
        require_knowledge_transfer: dto.require_knowledge_transfer ?? true,
        system_access_to_revoke: [...new Set(
          (dto.system_access_to_revoke ?? [])
            .map((value) => String(value).trim())
            .filter((value) => value.length > 0),
        )],
      })
      .eq('template_id', templateId)
      .eq('company_id', companyId)
      .select()
      .single();

    if (updateErr) throw new BadRequestException(updateErr.message);

    const { error: deleteItemsErr } = await supabase
      .from('offboarding_checklist_template_items')
      .delete()
      .eq('template_id', templateId);

    if (deleteItemsErr) {
      DatabaseErrorHandler.handle(deleteItemsErr, 'updateChecklistTemplate.deleteItems', this.logger);
    }

    if (dto.items?.length) {
      const rows = dto.items.map((item) => ({
        item_id: crypto.randomUUID(),
        template_id: templateId,
        item_name: item.item_name,
        description: item.description ?? null,
        is_required: item.is_required,
        category: item.category ?? null,
        is_custom: item.is_custom ?? false,
      }));
      const { error: insertItemsErr } = await supabase
        .from('offboarding_checklist_template_items')
        .insert(rows);
      if (insertItemsErr) {
        DatabaseErrorHandler.handle(insertItemsErr, 'updateChecklistTemplate.insertItems', this.logger);
      }
    }

    this.auditService.log(
      `OFFBOARDING_TEMPLATE_UPDATED: ${dto.template_name}`,
      actorUserId,
      companyId,
    ).catch((err) => this.logger.error('Audit failed in updateChecklistTemplate', err));

    return { ...updatedTemplate, items: dto.items ?? [] };
  }

  async deleteChecklistTemplate(templateId: string, companyId: string, actorUserId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: existing, error: findErr } = await supabase
      .from('offboarding_checklist_templates')
      .select('template_id, template_name, company_id')
      .eq('template_id', templateId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (findErr) throw new BadRequestException(findErr.message);
    if (!existing) throw new NotFoundException('Checklist template not found.');

    const { error: deleteItemsErr } = await supabase
      .from('offboarding_checklist_template_items')
      .delete()
      .eq('template_id', templateId);
    if (deleteItemsErr) {
      DatabaseErrorHandler.handle(deleteItemsErr, 'deleteChecklistTemplate.deleteItems', this.logger);
    }

    const { error: deleteTemplateErr } = await supabase
      .from('offboarding_checklist_templates')
      .delete()
      .eq('template_id', templateId)
      .eq('company_id', companyId);
    if (deleteTemplateErr) {
      DatabaseErrorHandler.handle(deleteTemplateErr, 'deleteChecklistTemplate.deleteTemplate', this.logger);
    }

    this.auditService.log(
      `OFFBOARDING_TEMPLATE_DELETED: ${(existing as any).template_name ?? templateId}`,
      actorUserId,
      companyId,
    ).catch((err) => this.logger.error('Audit failed in deleteChecklistTemplate', err));

    return { success: true };
  }

  // =========================================================
  // CASES — Create, Read, Status
  // =========================================================

  async resetCase(caseId: string, actorUserId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: caseRow, error: caseError } = await supabase
      .from('offboarding_cases')
      .select('case_id, employee_id, status')
      .eq('case_id', caseId)
      .maybeSingle();

    if (caseError) throw new BadRequestException(caseError.message);
    if (!caseRow) throw new NotFoundException('Offboarding case not found.');
    if ((caseRow as any).status === 'Completed') {
      throw new BadRequestException('Completed offboarding cases cannot be reset.');
    }

    const { data: employee, error: employeeError } = await supabase
      .from('user_profile')
      .select('company_id')
      .eq('user_id', (caseRow as any).employee_id)
      .maybeSingle();

    if (employeeError) throw new BadRequestException(employeeError.message);
    const companyId = (employee as any)?.company_id ?? '';

    await Promise.all([
      supabase.from('resignation_details').delete().eq('case_id', caseId),
      supabase.from('termination_details').delete().eq('case_id', caseId),
      supabase.from('checklist_items').delete().eq('case_id', caseId),
      supabase.from('knowledge_transfer').delete().eq('case_id', caseId),
      supabase.from('system_access').delete().eq('case_id', caseId),
      supabase.from('final_pay').delete().eq('case_id', caseId),
      supabase.from('clearance_documents').delete().eq('case_id', caseId),
      supabase.from('offboarding_vacant_positions').delete().eq('case_id', caseId),
      supabase.from('payroll_log').delete().eq('case_id', caseId).eq('type', 'final_pay_offboarding'),
      supabase
        .from('cnb_payslips')
        .delete()
        .in(
          'payslip_id',
          (await this.findSettlementPayslips(companyId, caseId))
            .map((row) => String(row.payslip_id ?? ''))
            .filter(Boolean),
        ),
    ]);

    const { error: deleteCaseError } = await supabase
      .from('offboarding_cases')
      .delete()
      .eq('case_id', caseId);

    if (deleteCaseError) throw new BadRequestException(deleteCaseError.message);

    this.auditService.log(
      `OFFBOARDING_CASE_RESET: case ${caseId}`,
      actorUserId,
      companyId,
      (caseRow as any).employee_id,
    ).catch((err) => this.logger.error('Audit failed in resetCase', err));

    return { success: true, case_id: caseId };
  }

  async createCase(dto: CreateOffboardingCaseDto, initiatedById: string) {
    const supabase = this.supabaseService.getClient();

    // 1. Validate employee exists + get company_id
    const { data: employee, error: empErr } = await supabase
      .from('user_profile')
      .select('user_id, first_name, last_name, company_id, email, department_id')
      .eq('user_id', dto.employee_id)
      .maybeSingle();
    if (empErr || !employee) throw new NotFoundException('Employee not found.');

    // 2. Check no active case already exists
    const { data: existing } = await supabase
      .from('offboarding_cases')
      .select('case_id')
      .eq('employee_id', dto.employee_id)
      .not('status', 'in', '("Completed","Rejected")')
      .maybeSingle();
    if (existing) throw new BadRequestException('Employee already has an active offboarding case.');

    // 3. Insert main case — initial status is 'Submitted' (Pending in callflow)
    const { data: newCase, error: caseErr } = await supabase
      .from('offboarding_cases')
      .insert({
        employee_id: dto.employee_id,
        initiated_by_id: initiatedById,
        offboarding_type: dto.offboarding_type,
        last_working_day: dto.last_working_day,
        selected_template_id: dto.template_id ?? null,
        status: 'Submitted',
      })
      .select().single();
    if (caseErr) throw new BadRequestException(caseErr.message);

    const caseId = (newCase as any).case_id;
    const emp = employee as any;
    const employeeName = `${emp.first_name} ${emp.last_name}`;

    // 4. Insert resignation or termination details
    if (dto.offboarding_type === 'Resignation' && dto.resignation) {
      await supabase.from('resignation_details').insert({ case_id: caseId, ...dto.resignation });
    }
    if (dto.offboarding_type === 'Termination' && dto.termination) {
      await supabase.from('termination_details').insert({ case_id: caseId, ...dto.termination });
    }

    // 5. Seed knowledge_transfer row
    await supabase.from('knowledge_transfer').insert({ case_id: caseId });

    // final_pay is NOT seeded here. It is created by recomputeFinalPayFromCompensation
    // when HR accepts the case, or lazily when HR first opens the final pay view.
    // Seeding a zero row here caused duplicate rows when the later upsert ran.

    // 6. Seed default system_access rows
    const defaultSystems = ['Email', 'HRIS System', 'Timekeeping System'];
    await supabase.from('system_access').insert(
      defaultSystems.map(s => ({ case_id: caseId, system_name: s })),
    );

    // 8. Notify HR AND Manager simultaneously (callflow: Employee Phase 1)
    this.notificationsService.notifyAllHRInCompany(emp.company_id, {
      type: 'OFFBOARDING_SUBMITTED',
      title: 'New Offboarding Case',
      message: `${employeeName} has submitted an offboarding request (${dto.offboarding_type}).`,
      metadata: { case_id: caseId, employee_id: dto.employee_id },
    }).catch(err => this.logger.error('Failed to notify HR in createCase', err));

    // FIX #2: Notify manager — look up the employee's direct manager and notify them
    // role_name lives in the role table (joined via role_id), not directly on user_profile
    if (emp.department_id) {
      const { data: managers } = await supabase
        .from('user_profile')
        .select('user_id, role:role_id(role_name)')
        .eq('company_id', emp.company_id)
        .eq('department_id', emp.department_id)
        .then(res => ({
          ...res,
          data: (res.data ?? []).filter((u: any) => u.role?.role_name === 'Manager'),
        }));
      if (managers && managers.length > 0) {
        await Promise.allSettled(
          (managers as any[]).map(mgr =>
            this.notificationsService.createNotification({
              userId: mgr.user_id,
              companyId: emp.company_id,
              type: 'OFFBOARDING_SUBMITTED',
              title: 'Team Member Resignation Submitted',
              message: `${employeeName} has submitted a resignation request. Please acknowledge it in the offboarding section.`,
              metadata: { case_id: caseId, employee_id: dto.employee_id },
            }).catch(err => this.logger.error('Failed to notify manager in createCase', err))
          )
        );
      }
    }

    // Audit
    this.auditService.log(
      `OFFBOARDING_CASE_CREATED: case ${caseId} type=${dto.offboarding_type}`,
      initiatedById, emp.company_id, dto.employee_id,
    ).catch(err => this.logger.error('Audit failed in createCase', err));

    this.logger.log(`Offboarding case created: ${caseId}`);
    return newCase;
  }

  async getMyCaseByEmployeeId(userId: string) {
    const supabase = this.supabaseService.getClient();
    const { data } = await supabase
      .from('offboarding_cases')
      .select('case_id')
      .eq('employee_id', userId)
      .order('created_at', { ascending: false })
      .limit(1).maybeSingle();
    if (!data) return null;
    return this.getCaseById((data as any).case_id);
  }

  async getAllCases(filters?: { status?: string; offboarding_type?: string }) {
    const supabase = this.supabaseService.getClient();
    let query = supabase.from('offboarding_cases').select('*').order('created_at', { ascending: false });
    if (filters?.status) query = (query as any).eq('status', filters.status);
    if (filters?.offboarding_type) query = (query as any).eq('offboarding_type', filters.offboarding_type);

    const { data: cases, error } = await query;
    if (error) {
      DatabaseErrorHandler.handle(error, 'getAllCases', this.logger);
    }

    return Promise.all((cases ?? []).map(async (c: any) => {
      const { data: emp } = await supabase
        .from('user_profile').select('first_name, last_name, role_id').eq('user_id', c.employee_id).maybeSingle();
      const employeeRoleId = String((emp as any)?.role_id ?? '').trim();
      const employeeRoleName =
        employeeRoleId.length > 0
          ? await supabase
              .from('role')
              .select('role_name')
              .eq('role_id', employeeRoleId)
              .maybeSingle()
              .then((result) => String((result.data as any)?.role_name ?? '').trim() || null)
          : null;
      return {
        ...c,
        employee_name: emp ? `${(emp as any).first_name} ${(emp as any).last_name}` : null,
        employee_role_name: employeeRoleName,
      };
    }));
  }

  async getCaseById(caseId: string) {
    const supabase = this.supabaseService.getClient();
    const { data: c, error } = await supabase
      .from('offboarding_cases').select('*').eq('case_id', caseId).maybeSingle();
    if (error || !c) throw new NotFoundException('Offboarding case not found.');

    const { data: emp } = await supabase
      .from('user_profile').select('first_name, last_name, company_id, role_id').eq('user_id', (c as any).employee_id).maybeSingle();
    const employeeRoleId = String((emp as any)?.role_id ?? '').trim();
    const employeeRoleName =
      employeeRoleId.length > 0
        ? await supabase
            .from('role')
            .select('role_name')
            .eq('role_id', employeeRoleId)
            .maybeSingle()
            .then((result) => String((result.data as any)?.role_name ?? '').trim() || null)
        : null;

    const [resignation, termination, checklist, kt, systemAccess, finalPay, clearance, vacantPosition] = await Promise.all([
      supabase.from('resignation_details').select('*').eq('case_id', caseId).maybeSingle().then(r => r.data),
      supabase.from('termination_details').select('*').eq('case_id', caseId).maybeSingle().then(r => r.data),
      supabase.from('checklist_items').select('*').eq('case_id', caseId).then(r => r.data ?? []),
      supabase.from('knowledge_transfer').select('*').eq('case_id', caseId).maybeSingle().then(r => r.data),
      supabase.from('system_access').select('*').eq('case_id', caseId).then(r => r.data ?? []),
      this.getLatestFinalPayRecord(caseId),
      supabase.from('clearance_documents').select('*').eq('case_id', caseId).then(r => r.data ?? []),
      supabase.from('offboarding_vacant_positions').select('status, job_posting_id').eq('case_id', caseId).maybeSingle().then(r => r.data),
    ]);

    const payroll_reference = await this.getLinkedPayrollReference(
      (c as any).employee_id,
      (emp as any)?.company_id ?? '',
      (c as any).last_working_day ?? null,
    );
    const settlement_payslip = await this.getFinalSettlementPayslip(
      caseId,
      (emp as any)?.company_id ?? '',
    );

    return {
      ...(c as any),
      employee_name: emp ? `${(emp as any).first_name} ${(emp as any).last_name}` : null,
      employee_role_name: employeeRoleName,
      resignation_details: resignation ?? null,
      termination_details: termination ?? null,
      checklist_items: checklist,
      knowledge_transfer: kt ?? null,
      system_access: systemAccess,
      final_pay: finalPay ? { ...(finalPay as any), payroll_reference, settlement_payslip } : null,
      clearance_documents: clearance,
      vacant_position: vacantPosition ?? null,
    };
  }

  // =========================================================
  // HR — Accept or Reject Resignation (Phase 3)
  // =========================================================

  async acceptRejectCase(
    caseId: string,
    action: string,
    hrUserId: string,
    rejectionReason?: string,
    templateId?: string,
  ) {
    const supabase = this.supabaseService.getClient();

    const { data: c } = await supabase
      .from('offboarding_cases').select('*').eq('case_id', caseId).maybeSingle();
    if (!c) throw new NotFoundException('Case not found.');
    if (String((c as any).employee_id ?? '') === hrUserId) {
      throw new ForbiddenException('You cannot review your own resignation request.');
    }
    if ((c as any).status !== 'Submitted' && (c as any).status !== 'Manager_Acknowledged') {
      throw new BadRequestException('Case must be in Submitted or Manager_Acknowledged status to accept/reject.');
    }
    if (action === 'Rejected' && !rejectionReason) {
      throw new BadRequestException('rejection_reason is required when rejecting a case.');
    }

    const newStatus = action === 'Accepted' ? 'HR_Accepted' : 'Rejected';
    const { error } = await supabase
      .from('offboarding_cases')
      .update({ status: newStatus, updated_at: new Date().toISOString(),
        ...(action === 'Accepted' && templateId ? { selected_template_id: templateId } : {}),
        ...(action === 'Rejected' ? { rejection_reason: rejectionReason } : {}) })
      .eq('case_id', caseId);
    if (error) {
      DatabaseErrorHandler.handle(error, 'acceptRejectCase', this.logger);
    }

    const { data: emp } = await supabase
      .from('user_profile').select('company_id, email, first_name, last_name, role_id').eq('user_id', (c as any).employee_id).maybeSingle();
    const companyId = (emp as any)?.company_id ?? '';
    const employeeRoleId = String((emp as any)?.role_id ?? '').trim();
    const employeeRoleName =
      employeeRoleId.length > 0
        ? await supabase
            .from('role')
            .select('role_name')
            .eq('role_id', employeeRoleId)
            .maybeSingle()
            .then((result) => String((result.data as any)?.role_name ?? '').trim())
        : '';

    // Notify employee of acceptance or rejection
    this.notificationsService.createNotification({
      userId: (c as any).employee_id,
      companyId,
      type: action === 'Accepted' ? 'OFFBOARDING_ACCEPTED' : 'OFFBOARDING_REJECTED',
      title: action === 'Accepted' ? 'Resignation Accepted' : 'Resignation Rejected',
      message: action === 'Accepted'
        ? 'Your resignation has been formally accepted. Your offboarding checklist is now available.'
        : `Your resignation has been rejected. Reason: ${rejectionReason}`,
      metadata: { case_id: caseId },
    }).catch(err => this.logger.error('Notification failed in acceptRejectCase', err));

    // If accepted: generate checklist, then attempt final pay computation.
    // Final pay computation is best-effort at acceptance time — it will be retried
    // lazily when HR opens the final pay view. This prevents a missing salary
    // baseline from blocking the entire resignation acceptance.
    if (action === 'Accepted') {
      await this.generateChecklistFromTemplate(
        caseId,
        (c as any).employee_id,
        companyId,
        (c as any).offboarding_type,
        templateId ?? (String((c as any).selected_template_id ?? '').trim() || undefined),
        employeeRoleName || undefined,
      );
      this.recomputeFinalPayFromCompensation(caseId).catch((err) => {
        this.logger.warn(
          `Final pay pre-computation skipped for case ${caseId}: ${err?.message ?? err}. ` +
          `It will be computed when HR opens the final pay view.`,
        );
      });
    }

    const auditAction = `OFFBOARDING_CASE_${action.toUpperCase()}: case ${caseId}`;
    const auditReason = action === 'Rejected' ? ` reason: ${rejectionReason}` : '';
    this.auditService.log(
      `${auditAction}${auditReason}`,
      hrUserId, companyId, (c as any).employee_id,
    ).catch(err => this.logger.error('Audit failed in acceptRejectCase', err));

    this.logger.log(`Case ${caseId} ${action} by HR ${hrUserId}`);
    return { case_id: caseId, status: newStatus };
  }

  // Auto-generate checklist from template on acceptance
  private async generateChecklistFromTemplate(
    caseId: string,
    employeeId: string,
    companyId: string,
    offboardingType: string,
    selectedTemplateId?: string,
    employeeRoleName?: string,
  ) {
    const supabase = this.supabaseService.getClient();

    const { data: templates } = await supabase
      .from('offboarding_checklist_templates')
      .select('template_id, employee_type, applicable_offboarding_types, is_default, require_knowledge_transfer, system_access_to_revoke, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();
    const parseTokens = (value: unknown) =>
      String(value ?? '')
        .split(/[/,|]/)
        .map((entry) => entry.trim())
        .filter(Boolean);

    const normalizedOffboardingType = normalize(offboardingType);
    const normalizedEmployeeRole = normalize(employeeRoleName);

    const selectedTemplate =
      (templates ?? [])
        .filter((template: any) => {
          if (selectedTemplateId) {
            return String(template.template_id) === String(selectedTemplateId);
          }

          const explicitTypes = Array.isArray(template.applicable_offboarding_types)
            ? template.applicable_offboarding_types.map((value: unknown) => normalize(value)).filter(Boolean)
            : [];

          const scopedTokens = parseTokens(template.employee_type).map((value) => normalize(value));
          const typeMatches =
            explicitTypes.length > 0
              ? explicitTypes.includes(normalizedOffboardingType)
              : scopedTokens.length === 0 || scopedTokens.includes(normalizedOffboardingType);

          if (!typeMatches) return false;
          if (!normalizedEmployeeRole) return true;

          const roleTokens = scopedTokens.filter((token) => token !== normalizedOffboardingType);
          return roleTokens.length === 0 || roleTokens.includes(normalizedEmployeeRole);
        })
        .sort((left: any, right: any) => {
          if (selectedTemplateId) {
            return String(right.created_at ?? '').localeCompare(String(left.created_at ?? ''));
          }

          const leftTokens = parseTokens(left.employee_type).map((value) => normalize(value));
          const rightTokens = parseTokens(right.employee_type).map((value) => normalize(value));
          const leftRoleSpecific = normalizedEmployeeRole ? leftTokens.includes(normalizedEmployeeRole) : false;
          const rightRoleSpecific = normalizedEmployeeRole ? rightTokens.includes(normalizedEmployeeRole) : false;

          if (leftRoleSpecific !== rightRoleSpecific) {
            return leftRoleSpecific ? -1 : 1;
          }
          if (Boolean(left.is_default) !== Boolean(right.is_default)) {
            return left.is_default ? -1 : 1;
          }
          return String(right.created_at ?? '').localeCompare(String(left.created_at ?? ''));
        })[0] ?? null;

    if (!selectedTemplate) {
      this.logger.warn(`No checklist template found for company ${companyId}. Using defaults.`);
      // Fall back to default items
      const defaults = [
        { item_name: 'Return laptop/device',                      category: 'Asset'    },
        { item_name: 'Return company ID / access card',           category: 'Asset'    },
        { item_name: 'Knowledge transfer documentation',          category: 'Task'     },
        { item_name: 'Clear personal files from company systems', category: 'Task'     },
        { item_name: 'Return parking pass (if applicable)',       category: 'Asset'    },
      ];
      await supabase.from('checklist_items').insert(
        defaults.map(d => ({ case_id: caseId, item_name: d.item_name, status: 'Pending', category: d.category, is_custom: false }))
      );
      await supabase
        .from('knowledge_transfer')
        .update({ status: 'Pending Manager Sign-Off' })
        .eq('case_id', caseId);
      await supabase
        .from('system_access')
        .delete()
        .eq('case_id', caseId);
      await supabase.from('system_access').insert(
        ['Email', 'HRIS System', 'Timekeeping System'].map((systemName) => ({
          case_id: caseId,
          system_name: systemName,
        })),
      );
      return;
    }

    const { data: templateItems } = await supabase
      .from('offboarding_checklist_template_items')
      .select('*')
      .eq('template_id', (selectedTemplate as any).template_id);

    if (templateItems && templateItems.length > 0) {
      await supabase.from('checklist_items').insert(
        templateItems.map((ti: any) => ({
          case_id:   caseId,
          item_name: ti.item_name,
          status:    'Pending',
          category:  ti.category ?? null,    // GAP-7.1 FIX
          is_custom: ti.is_custom ?? false,  // GAP-7.1 FIX
        }))
      );
    }

    await supabase
      .from('knowledge_transfer')
      .update({
        status: (selectedTemplate as any).require_knowledge_transfer === false
          ? 'Not Required'
          : 'Pending Manager Sign-Off',
      })
      .eq('case_id', caseId);

    const configuredSystems = Array.isArray((selectedTemplate as any).system_access_to_revoke)
      ? ((selectedTemplate as any).system_access_to_revoke as unknown[])
          .map((value) => String(value).trim())
          .filter((value) => value.length > 0)
      : [];

    await supabase
      .from('system_access')
      .delete()
      .eq('case_id', caseId);

    const resolvedSystems =
      configuredSystems.length > 0
        ? configuredSystems
        : ['Email', 'HRIS System', 'Timekeeping System'];

    await supabase.from('system_access').insert(
      resolvedSystems.map((systemName) => ({
        case_id: caseId,
        system_name: systemName,
      })),
    );

    // Notify employee that checklist has been assigned
    this.notificationsService.createNotification({
      userId: employeeId, companyId,
      type: 'OFFBOARDING_CHECKLIST_ASSIGNED',
      title: 'Offboarding Checklist Assigned',
      message: 'Your offboarding checklist has been generated. Please complete all items before your last working day.',
      metadata: { case_id: caseId },
    }).catch(err => this.logger.error('Failed to notify employee of checklist', err));
  }

  // =========================================================
  // STATUS — General update (Manager acknowledge, HR complete)
  // =========================================================

  async updateStatus(caseId: string, newStatus: string, user: { sub_userid: string; role_name: string }) {
    const supabase = this.supabaseService.getClient();

    const { data: c } = await supabase
      .from('offboarding_cases').select('*').eq('case_id', caseId).maybeSingle();
    if (!c) throw new NotFoundException('Case not found.');

    // Validate transition order
    const order = ['Submitted', 'Manager_Acknowledged', 'HR_Accepted', 'Completed'];
    const currentIdx = order.indexOf((c as any).status);
    const newIdx = order.indexOf(newStatus);
    if (newIdx !== currentIdx + 1) {
      throw new BadRequestException(
        `Cannot transition from "${(c as any).status}" to "${newStatus}". Must follow: ${order.join(' → ')}`,
      );
    }

    // Role permission per transition
    const hrRoles = [
      'HR Officer',
      'HR Offboarding Officer/Coordinator',
      'Admin',
      'System Admin',
    ];
    const managerRoles = ['Manager', ...hrRoles];
    if (newStatus === 'Manager_Acknowledged' && !managerRoles.includes(user.role_name)) {
      throw new ForbiddenException('Only a Manager or HR can acknowledge the case.');
    }
    if (['HR_Accepted', 'Completed'].includes(newStatus) && !hrRoles.includes(user.role_name)) {
      throw new ForbiddenException('Only HR can set this status.');
    }

    // Pre-completion checks
    if (newStatus === 'Completed') {
      await this.validateCompletionReadiness(caseId);
    }

    const { data: updated, error } = await supabase
      .from('offboarding_cases')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('case_id', caseId).select().single();
    if (error) {
      DatabaseErrorHandler.handle(error, 'updateStatus', this.logger);
    }

    const { data: emp } = await supabase
      .from('user_profile').select('company_id').eq('user_id', (c as any).employee_id).maybeSingle();
    const companyId = (emp as any)?.company_id ?? '';

    // If Manager_Acknowledged → notify HR
    if (newStatus === 'Manager_Acknowledged') {
      this.notificationsService.notifyAllHRInCompany(companyId, {
        type: 'OFFBOARDING_MANAGER_ACKNOWLEDGED',
        title: 'Manager Acknowledged Offboarding',
        message: `The manager has acknowledged the offboarding case. Please formally process it.`,
        metadata: { case_id: caseId },
      }).catch(err => this.logger.error('Failed to notify HR in updateStatus', err));
    }

    // If Completed → deactivate employee + trigger job posting
    if (newStatus === 'Completed') {
      await this.deactivateEmployee((c as any).employee_id, user.sub_userid, companyId, caseId);
    }

    // Notify employee of status change
    this.notificationsService.createNotification({
      userId: (c as any).employee_id, companyId,
      type: 'OFFBOARDING_STATUS_UPDATED',
      title: 'Offboarding Status Updated',
      message: `Your offboarding status has been updated to: ${newStatus}`,
      metadata: { case_id: caseId, status: newStatus },
    }).catch(err => this.logger.error('Notification failed in updateStatus', err));

    this.auditService.log(
      `OFFBOARDING_STATUS_UPDATED: case ${caseId} → ${newStatus}`,
      user.sub_userid, companyId, (c as any).employee_id,
    ).catch(err => this.logger.error('Audit failed in updateStatus', err));

    this.logger.log(`Case ${caseId} → ${newStatus}`);
    return updated;
  }

  private async validateCompletionReadiness(caseId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const issues: string[] = [];

    const { data: checklistItems } = await supabase
      .from('checklist_items').select('status').eq('case_id', caseId);
    const incomplete = (checklistItems ?? []).filter((i: any) => i.status !== 'Verified' && i.status !== 'Completed');
    if (incomplete.length > 0) issues.push(`${incomplete.length} checklist item(s) not yet verified`);

    const { data: kt } = await supabase
      .from('knowledge_transfer').select('status').eq('case_id', caseId).maybeSingle();
    if (!kt || (kt as any).status !== 'Signed Off') issues.push('Knowledge transfer not signed off');

    const { data: systems } = await supabase
      .from('system_access').select('status').eq('case_id', caseId);
    const active = (systems ?? []).filter((s: any) => s.status !== 'Revoked');
    if (active.length > 0) issues.push(`${active.length} system access record(s) not revoked`);

    const pay = await this.getLatestFinalPayRecord(caseId);
    if (!pay || !['Payment Released', 'Transfer Confirmed'].includes((pay as any).status)) {
      issues.push('Final pay not released');
    }

    if (issues.length > 0) {
      throw new BadRequestException(
        `Cannot complete case. Resolve these first: ${issues.join('; ')}.`
      );
    }
  }

  // =========================================================
  // EMPLOYEE DEACTIVATION + VACANCY TRIGGER (Phase 14 / Touchpoint Out 2)
  // =========================================================

  private async deactivateEmployee(employeeId: string, performedBy: string, companyId: string, caseId: string) {
    const supabase = this.supabaseService.getClient();

    // 1. Set employee account_status = Inactive, offboarding_status = Ended
    await supabase
      .from('user_profile')
      .update({ account_status: 'Inactive', offboarding_status: 'Ended', offboarded_at: new Date().toISOString() })
      .eq('user_id', employeeId);

    // 2. Get employee's position/department for job posting trigger
    const { data: emp } = await supabase
      .from('user_profile')
      .select('first_name, last_name, department_id, email')
      .eq('user_id', employeeId).maybeSingle();

    // 3. Create a vacant position record for HR to review and re-open
    // Always insert regardless of department_id — row must exist for triggerJobPosting to work
    await supabase.from('offboarding_vacant_positions').insert({
      case_id: caseId,
      employee_id: employeeId,
      department_id: (emp as any)?.department_id ?? null,
      company_id: companyId,
      status: 'Pending Review',
      created_at: new Date().toISOString(),
    });

    this.auditService.log(
      `OFFBOARDING_EMPLOYEE_DEACTIVATED: employee ${employeeId}`,
      performedBy, companyId, employeeId,
    ).catch(err => this.logger.error('Audit failed in deactivateEmployee', err));

    this.logger.log(`Employee ${employeeId} deactivated after offboarding completion`);
  }

  // =========================================================
  // HR — Flag Vacancy + Trigger Job Posting (Phase 13)
  // =========================================================

  async triggerJobPosting(caseId: string, hrUserId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: c } = await supabase
      .from('offboarding_cases').select('employee_id').eq('case_id', caseId).maybeSingle();
    if (!c) throw new NotFoundException('Case not found.');

    const { data: emp } = await supabase
      .from('user_profile')
      .select('first_name, last_name, department_id, company_id')
      .eq('user_id', (c as any).employee_id).maybeSingle();
    if (!emp) throw new NotFoundException('Employee profile not found.');

    const e = emp as any;

    let specificPositionTitle: string | null = null;

    const { data: latestCompletedSession } = await supabase
      .from('onboarding_sessions')
      .select('assigned_position')
      .eq('account_id', (c as any).employee_id)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (typeof (latestCompletedSession as any)?.assigned_position === 'string') {
      const assignedPosition = (latestCompletedSession as any).assigned_position.trim();
      if (assignedPosition) specificPositionTitle = assignedPosition;
    }

    if (!specificPositionTitle) {
      const { data: latestSession } = await supabase
        .from('onboarding_sessions')
        .select('assigned_position')
        .eq('account_id', (c as any).employee_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (typeof (latestSession as any)?.assigned_position === 'string') {
        const assignedPosition = (latestSession as any).assigned_position.trim();
        if (assignedPosition) specificPositionTitle = assignedPosition;
      }
    }

    const positionTitle = buildVacatedPositionTitle({
      specificPositionTitle,
      firstName: e.first_name,
      lastName: e.last_name,
    });

    // Create job posting in recruitment module
    const jobPostingId = crypto.randomUUID();
    const { error: jpErr } = await supabase.from('job_postings').insert({
      job_posting_id: jobPostingId,
      company_id: e.company_id,
      title: positionTitle,
      description: `Position vacated due to offboarding of ${e.first_name} ${e.last_name}.`,
      department_id: e.department_id ?? null,
      status: 'open',
      posted_at: new Date().toISOString(),
    });
    if (jpErr) throw new BadRequestException(jpErr.message);

    // Update vacant position to Opened
    await supabase.from('offboarding_vacant_positions')
      .update({ status: 'Opened', job_posting_id: jobPostingId })
      .eq('case_id', caseId);

    // Notify HR of re-opened position
    this.notificationsService.notifyAllHRInCompany(e.company_id, {
      type: 'OFFBOARDING_POSITION_REOPENED',
      title: 'Vacant Position Re-Opened',
      message: `The position vacated by ${e.first_name} ${e.last_name} has been re-opened for recruitment.`,
      metadata: { case_id: caseId, job_posting_id: jobPostingId },
    }).catch(err => this.logger.error('Notification failed in triggerJobPosting', err));

    // FIX #5: Notify managers in the same department that the position is now open for hiring
    // role_name lives in the role table (joined via role_id), not directly on user_profile
    if (e.department_id) {
      const { data: managers } = await supabase
        .from('user_profile')
        .select('user_id, role:role_id(role_name)')
        .eq('company_id', e.company_id)
        .eq('department_id', e.department_id)
        .then(res => ({
          ...res,
          data: (res.data ?? []).filter((u: any) => u.role?.role_name === 'Manager'),
        }));
      if (managers && managers.length > 0) {
        await Promise.allSettled(
          (managers as any[]).map(mgr =>
            this.notificationsService.createNotification({
              userId: mgr.user_id,
              companyId: e.company_id,
              type: 'OFFBOARDING_POSITION_REOPENED',
              title: 'Vacant Position Re-Opened for Recruitment',
              message: `The position vacated by ${e.first_name} ${e.last_name} in your team has been re-opened. The hiring process will begin shortly.`,
              metadata: { case_id: caseId, job_posting_id: jobPostingId },
            }).catch(err => this.logger.error('Failed to notify manager of re-opened position', err))
          )
        );
      }
    }

    this.auditService.log(
      `OFFBOARDING_JOB_POSTING_TRIGGERED: case ${caseId} posting ${jobPostingId}`,
      hrUserId, e.company_id, (c as any).employee_id,
    ).catch(err => this.logger.error('Audit failed in triggerJobPosting', err));

    return { message: 'Job posting created', job_posting_id: jobPostingId };
  }

  // =========================================================
  // CHECKLIST
  // =========================================================

  async getChecklist(caseId: string) {
    const { data, error } = await this.supabaseService.getClient()
      .from('checklist_items').select('*').eq('case_id', caseId);
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async addChecklistItem(caseId: string, itemName: string) {
    if (!itemName?.trim()) throw new BadRequestException('item_name is required.');
    const { data, error } = await this.supabaseService.getClient()
      .from('checklist_items')
      .insert({ case_id: caseId, item_name: itemName.trim(), status: 'Pending' })
      .select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateChecklistItem(itemId: string, status: string, userId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: item } = await supabase
      .from('checklist_items').select('item_id, case_id').eq('item_id', itemId).maybeSingle();
    if (!item) throw new NotFoundException('Checklist item not found.');

    // Callflow statuses: Pending → Submitted (employee) → Verified / Disputed (HR)
    const update: Record<string, any> = { status };
    if (status === 'Verified' || status === 'Completed') {
      update.cleared_by_id = userId;
      update.cleared_at = new Date().toISOString();
    } else if (status === 'Pending') {
      update.cleared_by_id = null;
      update.cleared_at = null;
    }

    const { data, error } = await supabase
      .from('checklist_items').update(update).eq('item_id', itemId).select().single();
    if (error) throw new BadRequestException(error.message);

    // If all items verified → notify employee (callflow: Employee Phase 6)
    if (status === 'Verified') {
      const { data: allItems } = await supabase
        .from('checklist_items').select('status').eq('case_id', (item as any).case_id);
      const allVerified = (allItems ?? []).every((i: any) => i.status === 'Verified' || i.status === 'Completed');
      if (allVerified) {
        const { data: c } = await supabase
          .from('offboarding_cases').select('employee_id').eq('case_id', (item as any).case_id).maybeSingle();
        if (c) {
          const { data: emp } = await supabase
            .from('user_profile').select('company_id').eq('user_id', (c as any).employee_id).maybeSingle();
          this.notificationsService.createNotification({
            userId: (c as any).employee_id,
            companyId: (emp as any)?.company_id ?? '',
            type: 'OFFBOARDING_CHECKLIST_COMPLETE',
            title: 'Clearance Process Complete',
            message: 'All your offboarding checklist items have been verified. Clearance confirmed.',
            metadata: { case_id: (item as any).case_id },
          }).catch(err => this.logger.error('Failed to notify checklist complete', err));
        }
      }
    }

    // Log to activity logs
    this.auditService.log(
      `OFFBOARDING_CHECKLIST_ITEM_UPDATED: item ${itemId} → ${status}`,
      userId, '', '',
    ).catch(err => this.logger.error('Audit failed in updateChecklistItem', err));

    return data;
  }

  // Employee acknowledges return of company asset (callflow: Employee Phase 5)
  async acknowledgeAssetReturn(itemId: string, employeeId: string, proofUrl?: string) {
    const supabase = this.supabaseService.getClient();
    const { data: item } = await supabase
      .from('checklist_items').select('item_id, case_id').eq('item_id', itemId).maybeSingle();
    if (!item) throw new NotFoundException('Checklist item not found.');

    const { data, error } = await supabase
      .from('checklist_items')
      .update({ status: 'Submitted' })
      .eq('item_id', itemId).select().single();
    if (error) throw new BadRequestException(error.message);

    this.auditService.log(
      `OFFBOARDING_ASSET_RETURN_ACKNOWLEDGED: item ${itemId}${proofUrl ? ' with proof' : ''}`,
      employeeId, '', '',
    ).catch(err => this.logger.error('Audit failed in acknowledgeAssetReturn', err));

    return data;
  }

  private async listFinalPayRecords(caseId: string) {
    const { data, error } = await this.supabaseService.getClient()
      .from('final_pay')
      .select('*')
      .eq('case_id', caseId);

    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  private pickCurrentFinalPay<T extends Record<string, unknown>>(rows: T[] | null | undefined): T | null {
    if (!rows || rows.length === 0) return null;

    const statusRank = (status: unknown) => {
      switch (status) {
        case 'Transfer Confirmed':
          return 4;
        case 'Payment Released':
          return 3;
        case 'Ready for Review':
          return 2;
        default:
          return 1;
      }
    };

    return [...rows].sort((a, b) => {
      const byStatus = statusRank(b.status) - statusRank(a.status);
      if (byStatus !== 0) return byStatus;

      const aConfirmed = a.transfer_confirmed_at ? 1 : 0;
      const bConfirmed = b.transfer_confirmed_at ? 1 : 0;
      return bConfirmed - aConfirmed;
    })[0];
  }

  private async getLatestFinalPayRecord(caseId: string) {
    const rows = await this.listFinalPayRecords(caseId);
    return this.pickCurrentFinalPay(rows);
  }

  // =========================================================
  // KNOWLEDGE TRANSFER
  // =========================================================

  async getKnowledgeTransfer(caseId: string) {
    const { data, error } = await this.supabaseService.getClient()
      .from('knowledge_transfer').select('*').eq('case_id', caseId).maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateKnowledgeTransfer(caseId: string, dto: UpdateKnowledgeTransferDto, userId: string) {
    const supabase = this.supabaseService.getClient();
    const update: Record<string, any> = {};
    if (dto.transfer_notes !== undefined) update.transfer_notes = dto.transfer_notes;
    if (dto.action === 'sign_off') {
      update.status = 'Signed Off';
      update.signed_off_by_id = userId;
      update.signed_off_at = new Date().toISOString();
    }
    if (Object.keys(update).length === 0) {
      throw new BadRequestException('Nothing to update. Provide transfer_notes or action: sign_off.');
    }

    const { data, error } = await supabase
      .from('knowledge_transfer').update(update).eq('case_id', caseId).select().single();
    if (error) throw new BadRequestException(error.message);

    // If signed off → notify HR and log (callflow: Manager Phase 4)
    if (dto.action === 'sign_off') {
      const { data: c } = await supabase
        .from('offboarding_cases').select('employee_id').eq('case_id', caseId).maybeSingle();
      if (c) {
        const { data: emp } = await supabase
          .from('user_profile').select('company_id').eq('user_id', (c as any).employee_id).maybeSingle();
        this.notificationsService.notifyAllHRInCompany((emp as any)?.company_id ?? '', {
          type: 'OFFBOARDING_KT_SIGNED_OFF',
          title: 'Knowledge Transfer Signed Off',
          message: `Knowledge transfer for offboarding case ${caseId} has been signed off by manager.`,
          metadata: { case_id: caseId },
        }).catch(err => this.logger.error('Failed to notify HR of KT sign-off', err));

        this.auditService.log(
          `OFFBOARDING_KT_SIGNED_OFF: case ${caseId}`,
          userId, (emp as any)?.company_id ?? '', (c as any).employee_id,
        ).catch(err => this.logger.error('Audit failed in KT sign-off', err));
      }
    }
    return data;
  }

  // =========================================================
  // SYSTEM ACCESS
  // =========================================================

  async getSystemAccess(caseId: string) {
    const { data, error } = await this.supabaseService.getClient()
      .from('system_access').select('*').eq('case_id', caseId);
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async addSystemAccess(caseId: string, systemName: string) {
    if (!systemName?.trim()) throw new BadRequestException('system_name is required.');
    const { data, error } = await this.supabaseService.getClient()
      .from('system_access')
      .insert({ case_id: caseId, system_name: systemName.trim() })
      .select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async revokeSystemAccess(accessId: string, userId: string) {
    const supabase = this.supabaseService.getClient();
    const { data: row } = await supabase
      .from('system_access').select('access_id').eq('access_id', accessId).maybeSingle();
    if (!row) throw new NotFoundException('System access record not found.');

    const { data, error } = await supabase
      .from('system_access')
      .update({ status: 'Revoked', revoked_by_id: userId, revoked_at: new Date().toISOString() })
      .eq('access_id', accessId).select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // =========================================================
  // FINAL PAY (Phases 8–10)
  // =========================================================

  async getFinalPay(caseId: string) {
    const supabase = this.supabaseService.getClient();
    const { data: caseRow } = await supabase
      .from('offboarding_cases')
      .select('employee_id, last_working_day')
      .eq('case_id', caseId)
      .maybeSingle();
    const { data: employee } = await supabase
      .from('user_profile')
      .select('company_id')
      .eq('user_id', (caseRow as any)?.employee_id ?? '')
      .maybeSingle();
    const data = await this.getLatestFinalPayRecord(caseId);
    if (!data) {
      return this.recomputeFinalPayFromCompensation(caseId);
    }

    const requiresRecompute =
      [data.salary_balance, data.leave_encashment, data.additional_pay, data.deductions, data.total_amount]
        .some((value) => value === null || value === undefined) ||
      (
        Number(data.salary_balance ?? 0) === 0 &&
        Number(data.leave_encashment ?? 0) === 0 &&
        Number(data.additional_pay ?? 0) === 0 &&
        Number(data.total_amount ?? 0) === 0 &&
        data.status !== 'Payment Released' &&
        data.status !== 'Transfer Confirmed'
      );

    const resolved = !requiresRecompute ? data : await this.recomputeFinalPayFromCompensation(caseId);
    const payroll_reference = caseRow && employee
      ? await this.getLinkedPayrollReference(
          (caseRow as any).employee_id,
          (employee as any).company_id ?? '',
          (caseRow as any).last_working_day ?? null,
        )
      : null;
    const settlement_payslip = employee
      ? await this.getFinalSettlementPayslip(caseId, (employee as any).company_id ?? '')
      : null;

    return {
      ...(resolved as any),
      payroll_reference,
      settlement_payslip,
    };
  }

  async recomputeFinalPayManual(caseId: string) {
    this.logger.log(`Manual recompute triggered for final pay of case ${caseId}`);
    return this.recomputeFinalPayFromCompensation(caseId);
  }

  async updateFinalPay(caseId: string, dto: UpdateFinalPayDto) {
    // total always computed server-side — never trusted from client
    const total = this.roundCurrency(
      Number(dto.salary_balance) +
      Number(dto.leave_encashment) +
      Number(dto.additional_pay) -
      Number(dto.deductions),
    );
    const supabase = this.supabaseService.getClient();
    const payload = { ...dto, total_amount: total, status: 'Ready for Review' };
    const existingPay = await this.getLatestFinalPayRecord(caseId);

    let data: any = null;
    if (existingPay) {
      const { data: updatedRows, error } = await supabase
        .from('final_pay')
        .update(payload)
        .eq('case_id', caseId)
        .select();
      if (error) throw new BadRequestException(error.message);
      data = this.pickCurrentFinalPay(updatedRows as Record<string, unknown>[] | null);
    } else {
      const { data: inserted, error } = await supabase
        .from('final_pay')
        .insert({ case_id: caseId, ...payload })
        .select()
        .single();
      if (error) throw new BadRequestException(error.message);
      data = inserted;
    }

    const { data: caseRow } = await supabase
      .from('offboarding_cases')
      .select('employee_id, initiated_by_id, last_working_day')
      .eq('case_id', caseId)
      .maybeSingle();
    const { data: employee } = await supabase
      .from('user_profile')
      .select('company_id')
      .eq('user_id', (caseRow as any)?.employee_id ?? '')
      .maybeSingle();
    if (caseRow && employee && (caseRow as any).last_working_day) {
      await this.syncFinalSettlementPayslip({
        caseId,
        companyId: (employee as any).company_id ?? '',
        employeeId: (caseRow as any).employee_id,
        actorId: (caseRow as any).initiated_by_id ?? (caseRow as any).employee_id,
        lastWorkingDay: (caseRow as any).last_working_day,
        finalPay: {
          salary_balance: Number(dto.salary_balance),
          leave_encashment: Number(dto.leave_encashment),
          additional_pay: Number(dto.additional_pay),
          // Manual override: HR sets deductions as a total; individual split unknown
          tax_deduction: 0,
          statutory_deductions: 0,
          deductions: Number(dto.deductions),
          total_amount: total,
          status: 'Ready for Review',
        },
      });
    }

    // Notify employee that final pay is ready (callflow: Employee Phase 7)
    const { data: c } = await this.supabaseService.getClient()
      .from('offboarding_cases').select('employee_id').eq('case_id', caseId).maybeSingle();
    if (c) {
      const { data: emp } = await this.supabaseService.getClient()
        .from('user_profile').select('company_id').eq('user_id', (c as any).employee_id).maybeSingle();
      this.notificationsService.createNotification({
        userId: (c as any).employee_id,
        companyId: (emp as any)?.company_id ?? '',
        type: 'OFFBOARDING_FINAL_PAY_READY',
        title: 'Final Pay Ready for Review',
        message: 'Your final pay breakdown has been computed and is ready for review.',
        metadata: { case_id: caseId, total_amount: total },
      }).catch(err => this.logger.error('Failed to notify final pay ready', err));
    }
    return data;
  }

  async releaseFinalPay(caseId: string) {
    const supabase = this.supabaseService.getClient();
    const pay = await this.getLatestFinalPayRecord(caseId);
    if (!pay) throw new NotFoundException('Final pay record not found.');

    const { data: updatedRows, error } = await supabase
      .from('final_pay')
      .update({ status: 'Payment Released' })
      .eq('case_id', caseId)
      .select();
    if (error) throw new BadRequestException(error.message);
    const data = this.pickCurrentFinalPay(updatedRows as Record<string, unknown>[] | null);

    const { data: c } = await supabase
      .from('offboarding_cases').select('employee_id').eq('case_id', caseId).maybeSingle();
    if (c) {
      const { data: emp } = await supabase
        .from('user_profile').select('company_id').eq('user_id', (c as any).employee_id).maybeSingle();
      const { data: caseRow } = await supabase
        .from('offboarding_cases')
        .select('initiated_by_id, last_working_day')
        .eq('case_id', caseId)
        .maybeSingle();
      // Status-only transition — update the existing payslip status without touching encrypted amounts
      await this.updateSettlementPayslipStatus((emp as any)?.company_id ?? '', caseId, 'Final Pay');
      this.notificationsService.createNotification({
        userId: (c as any).employee_id, companyId: (emp as any)?.company_id ?? '',
        type: 'OFFBOARDING_FINAL_PAY_RELEASED',
        title: 'Final Pay Released',
        message: 'Your final pay has been processed and released.',
        metadata: { case_id: caseId },
      }).catch(err => this.logger.error('Failed to notify final pay released', err));
    }
    this.logger.log(`Final pay released for case ${caseId}`);
    return data;
  }

  // Record bank transfer confirmation (callflow: HR Phase 10)
  async recordPayTransferConfirmation(caseId: string, hrUserId: string) {
    const supabase = this.supabaseService.getClient();
    const pay = await this.getLatestFinalPayRecord(caseId);
    if (!pay) throw new NotFoundException('Final pay record not found.');

    const { data: c } = await supabase
      .from('offboarding_cases').select('employee_id').eq('case_id', caseId).maybeSingle();
    const { data: emp } = await supabase
      .from('user_profile').select('company_id').eq('user_id', (c as any)?.employee_id ?? '').maybeSingle();

    const confirmationPayload = {
      case_id: caseId,
      employee_id: (c as any)?.employee_id,
      company_id: (emp as any)?.company_id ?? '',
      total_amount: (pay as any).total_amount,
      confirmed_by: hrUserId,
      confirmed_at: new Date().toISOString(),
      type: 'final_pay_offboarding',
    };

    const { data: existingLog, error: existingLogError } = await supabase
      .from('payroll_log')
      .select('case_id')
      .eq('case_id', caseId)
      .eq('type', 'final_pay_offboarding')
      .maybeSingle();
    if (existingLogError) throw new BadRequestException(existingLogError.message);

    if (existingLog) {
      const { error: updateLogError } = await supabase
        .from('payroll_log')
        .update(confirmationPayload)
        .eq('case_id', caseId)
        .eq('type', 'final_pay_offboarding');
      if (updateLogError) throw new BadRequestException(updateLogError.message);
    } else {
      const { error: insertLogError } = await supabase.from('payroll_log').insert(confirmationPayload);
      if (insertLogError) throw new BadRequestException(insertLogError.message);
    }

    await supabase.from('final_pay')
      .update({ status: 'Transfer Confirmed', transfer_confirmed_at: new Date().toISOString() })
      .eq('case_id', caseId);

    const { data: caseRow } = await supabase
      .from('offboarding_cases')
      .select('last_working_day')
      .eq('case_id', caseId)
      .maybeSingle();
    // Status-only transition — update the existing payslip status without touching encrypted amounts
    await this.updateSettlementPayslipStatus(
      (emp as any)?.company_id ?? '',
      caseId,
      'Transfer Confirmed',
    );

    this.auditService.log(
      `OFFBOARDING_BANK_TRANSFER_CONFIRMED: case ${caseId}`,
      hrUserId, (emp as any)?.company_id ?? '', (c as any)?.employee_id ?? '',
    ).catch(err => this.logger.error('Audit failed in recordPayTransferConfirmation', err));

    return { message: 'Bank transfer confirmation recorded', case_id: caseId };
  }

  // =========================================================
  // CLEARANCE DOCUMENTS (Employee Phase 8 / HR Phase 11–12)
  // =========================================================

  async getClearanceDocuments(caseId: string) {
    const { data, error } = await this.supabaseService.getClient()
      .from('clearance_documents').select('*').eq('case_id', caseId);
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async releaseClearanceDocuments(caseId: string, hrUserId: string, notes?: string) {
    const supabase = this.supabaseService.getClient();

    // Guard: all checklist items must be Verified first (callflow: HR Phase 11)
    const { data: checklistItems } = await supabase
      .from('checklist_items').select('status').eq('case_id', caseId);
    const notVerified = (checklistItems ?? []).filter((i: any) => i.status !== 'Verified' && i.status !== 'Completed');
    if (notVerified.length > 0) {
      throw new BadRequestException(
        `Cannot release clearance documents. ${notVerified.length} checklist item(s) not yet verified.`
      );
    }

    // Generate clearance certificate record
    const { data: c } = await supabase
      .from('offboarding_cases').select('employee_id').eq('case_id', caseId).maybeSingle();
    const { data: emp } = await supabase
      .from('user_profile').select('first_name, last_name, company_id').eq('user_id', (c as any)?.employee_id ?? '').maybeSingle();

    const docId = crypto.randomUUID();
    const { data: doc, error: docErr } = await supabase.from('clearance_documents').insert({
      document_id: docId,
      case_id: caseId,
      document_type: 'clearance_certificate',
      document_name: `Clearance Certificate - ${(emp as any)?.first_name} ${(emp as any)?.last_name}`,
      status: 'Released',
      released_by: hrUserId,
      released_at: new Date().toISOString(),
      notes: notes ?? null,
    }).select().single();
    if (docErr) throw new BadRequestException(docErr.message);

    // Notify employee — clearance released (callflow: Employee Phase 8)
    this.notificationsService.createNotification({
      userId: (c as any)?.employee_id ?? '',
      companyId: (emp as any)?.company_id ?? '',
      type: 'OFFBOARDING_CLEARANCE_RELEASED',
      title: 'Clearance Documents Released',
      message: 'Your clearance documents are now available for download.',
      metadata: { case_id: caseId, document_id: docId },
    }).catch(err => this.logger.error('Failed to notify clearance release', err));

    this.auditService.log(
      `OFFBOARDING_CLEARANCE_RELEASED: case ${caseId}`,
      hrUserId, (emp as any)?.company_id ?? '', (c as any)?.employee_id ?? '',
    ).catch(err => this.logger.error('Audit failed in releaseClearanceDocuments', err));

    return doc;
  }
}
