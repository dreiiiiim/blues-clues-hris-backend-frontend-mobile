import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CnbService } from './cnb.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import { SetSalaryBaselineDto } from './dto/set-salary-baseline.dto';
import { BulkSetSalaryBaselineDto } from './dto/bulk-set-salary-baseline.dto';
import { CreateBenefitDto } from './dto/create-benefit.dto';
import { AssignBenefitDto } from './dto/assign-benefit.dto';
import { SaveStatutoryIdsDto } from './dto/save-statutory-ids.dto';
import { SetTaxBracketDto } from './dto/set-tax-bracket.dto';
import { UpdateBenefitCatalogDto } from './dto/update-benefit-catalog.dto';
import { SetStatutoryDeductionsDto } from './dto/set-statutory-deductions.dto';

const HR_AND_ABOVE = [
  'Admin',
  'System Admin',
  'HR Officer',
  'HR Compensation and Benefits Officer',
];

const CNB_OFFICER_AND_ADMIN = [
  'Admin',
  'System Admin',
  'HR Officer',
  'HR Compensation and Benefits Officer',
];

const SYSTEM_ADMIN_ONLY = ['System Admin'];

@ApiTags('Compensation & Benefits')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cnb')
export class CnbController {
  constructor(private readonly cnbService: CnbService) {}

  @Get('salary-baselines')
  @UseGuards(RolesGuard)
  @Roles(...CNB_OFFICER_AND_ADMIN)
  @ApiOperation({ summary: 'Get latest salary baseline for every employee in the company' })
  getAllSalaryBaselines(@Req() req: AuthenticatedRequest) {
    return this.cnbService.getAllSalaryBaselines(req.user.company_id);
  }

  @Get('salary-baselines/:userId')
  @UseGuards(RolesGuard)
  @Roles(...CNB_OFFICER_AND_ADMIN)
  @ApiOperation({ summary: 'Get salary baseline for an employee' })
  @ApiResponse({
    status: 200,
    description: 'Salary baseline retrieved',
    schema: {
      example: {
        salary_baseline_id: 'uuid',
        user_id: 'uuid',
        basic_salary: 25000,
        pay_frequency: 'monthly',
        effective_date: '2026-05-01',
      },
    },
  })
  getSalaryBaseline(
    @Param('userId') userId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.cnbService.getSalaryBaseline(userId, req.user.company_id);
  }

  @Post('salary-baselines')
  @UseGuards(RolesGuard)
  @Roles(...CNB_OFFICER_AND_ADMIN)
  @ApiOperation({ summary: 'Set or update salary baseline for an employee' })
  @ApiResponse({
    status: 201,
    description: 'Salary baseline created',
  })
  setSalaryBaseline(
    @Body() dto: SetSalaryBaselineDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.cnbService.setSalaryBaseline(
      { ...dto, company_id: req.user.company_id },
      req.user.sub_userid,
    );
  }

  @Post('salary-baselines/bulk')
  @UseGuards(RolesGuard)
  @Roles(...CNB_OFFICER_AND_ADMIN)
  @ApiOperation({
    summary: 'Set salary baseline for multiple employees at once',
    description:
      'Bulk set salary baselines for all or specific employees. Useful for initial onboarding or mass updates.',
  })
  @ApiResponse({
    status: 201,
    description: 'Salary baselines created for multiple employees',
    schema: {
      example: {
        count: 25,
        message: 'Salary baselines set for 25 employees',
        results: [
          {
            user_id: 'uuid',
            employee_id: 'emp-001',
            name: 'John Doe',
            status: 'success',
          },
        ],
      },
    },
  })
  setBulkSalaryBaselines(
    @Body() dto: BulkSetSalaryBaselineDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.cnbService.setBulkSalaryBaselines(
      req.user.company_id,
      dto.basic_salary,
      dto.pay_frequency,
      dto.effective_date,
      dto.employee_ids,
      dto.only_missing,
      req.user.sub_userid,
    );
  }

  @Get('statutory-deduction-config')
  @UseGuards(RolesGuard)
  @Roles(...CNB_OFFICER_AND_ADMIN)
  @ApiOperation({ summary: 'Get SSS/PhilHealth/PAG-IBIG deduction configuration for this company' })
  getStatutoryConfig(@Req() req: AuthenticatedRequest) {
    return this.cnbService.getBenefitDefaults(req.user.company_id);
  }

  @Post('statutory-deduction-config')
  @UseGuards(RolesGuard)
  @Roles(...SYSTEM_ADMIN_ONLY)
  @ApiOperation({ summary: 'Configure SSS/PhilHealth/PAG-IBIG rates (percentage or fixed amount)' })
  setStatutoryConfig(
    @Body() dto: SetStatutoryDeductionsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.cnbService.setBenefitDefaults(req.user.company_id, dto, req.user.sub_userid);
  }

  @Get('benefits-catalog')
  @UseGuards(RolesGuard)
  @Roles(...CNB_OFFICER_AND_ADMIN)
  @ApiOperation({ summary: 'Get all benefits in the catalog' })
  getBenefitsCatalog(@Req() req: AuthenticatedRequest) {
    return this.cnbService.getBenefitsCatalog(req.user.company_id);
  }

  @Post('benefits-catalog')
  @UseGuards(RolesGuard)
  @Roles(...CNB_OFFICER_AND_ADMIN)
  @ApiOperation({ summary: 'Create a new benefit type' })
  @ApiResponse({
    status: 201,
    description: 'Benefit created',
  })
  createBenefit(
    @Body() dto: CreateBenefitDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.cnbService.createBenefit(
      { ...dto, company_id: req.user.company_id },
      req.user.sub_userid,
    );
  }

  @Patch('benefits-catalog/:benefitId')
  @UseGuards(RolesGuard)
  @Roles(...CNB_OFFICER_AND_ADMIN)
  @ApiOperation({ summary: 'Update a benefit catalog item' })
  @ApiResponse({
    status: 200,
    description: 'Benefit catalog item updated',
  })
  updateBenefitCatalogItem(
    @Param('benefitId') benefitId: string,
    @Body() dto: UpdateBenefitCatalogDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.cnbService.updateBenefitCatalogItem(
      req.user.company_id,
      benefitId,
      dto,
      req.user.sub_userid,
    );
  }

  @Get('employee-benefits/:userId')
  @UseGuards(RolesGuard)
  @Roles(...CNB_OFFICER_AND_ADMIN)
  @ApiOperation({ summary: 'Get all benefits assigned to an employee' })
  getEmployeeBenefits(
    @Param('userId') userId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.cnbService.getEmployeeBenefits(userId, req.user.company_id);
  }

  @Post('employee-benefits')
  @UseGuards(RolesGuard)
  @Roles(...CNB_OFFICER_AND_ADMIN)
  @ApiOperation({ summary: 'Assign a benefit to an employee' })
  @ApiResponse({
    status: 201,
    description: 'Benefit assigned',
  })
  assignBenefit(
    @Body() dto: AssignBenefitDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.cnbService.assignBenefit(
      req.user.company_id,
      dto,
      req.user.sub_userid,
    );
  }

  @Delete('employee-benefits/:mappingId')
  @UseGuards(RolesGuard)
  @Roles(...CNB_OFFICER_AND_ADMIN)
  @ApiOperation({ summary: 'Remove a benefit assignment from an employee' })
  @ApiResponse({
    status: 200,
    description: 'Benefit assignment removed',
  })
  removeEmployeeBenefit(
    @Param('mappingId') mappingId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.cnbService.removeEmployeeBenefit(
      mappingId,
      req.user.company_id,
      req.user.sub_userid,
    );
  }

  @Get('employee-benefits-history/:userId')
  @UseGuards(RolesGuard)
  @Roles(...CNB_OFFICER_AND_ADMIN)
  @ApiOperation({ summary: 'Get benefit history for an employee' })
  @ApiResponse({
    status: 200,
    description: 'Benefit history retrieved',
  })
  getBenefitHistory(
    @Param('userId') userId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.cnbService.getBenefitHistory(userId);
  }

  @Get('statutory-ids/:userId')
  @UseGuards(RolesGuard)
  @Roles(...CNB_OFFICER_AND_ADMIN)
  @ApiOperation({ summary: 'Get statutory IDs for an employee' })
  getStatutoryIds(
    @Param('userId') userId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.cnbService.getStatutoryIds(userId, req.user.company_id);
  }

  @Patch('statutory-ids/:userId')
  @UseGuards(RolesGuard)
  @Roles(...CNB_OFFICER_AND_ADMIN)
  @ApiOperation({ summary: 'Save or update statutory IDs for an employee' })
  @ApiResponse({
    status: 200,
    description: 'Statutory IDs updated',
  })
  saveStatutoryIds(
    @Param('userId') userId: string,
    @Body() dto: SaveStatutoryIdsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.cnbService.saveStatutoryIds(
      userId,
      req.user.company_id,
      dto,
      req.user.sub_userid,
    );
  }

  @Get('tax-brackets')
  @UseGuards(RolesGuard)
  @Roles(...CNB_OFFICER_AND_ADMIN)
  @ApiOperation({ summary: 'Get tax brackets' })
  getTaxBrackets(
    @Req() req: AuthenticatedRequest,
    @Query('year') year?: string,
  ) {
    const parsedYear = year ? Number(year) : undefined;
    return this.cnbService.getTaxBrackets(req.user.company_id, parsedYear);
  }

  @Post('tax-brackets')
  @UseGuards(RolesGuard)
  @Roles(...SYSTEM_ADMIN_ONLY)
  @ApiOperation({ summary: 'Create a new tax bracket' })
  @ApiResponse({
    status: 201,
    description: 'Tax bracket created',
  })
  createTaxBracket(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SetTaxBracketDto,
  ) {
    return this.cnbService.createTaxBracket(
      req.user.company_id,
      dto,
      req.user.sub_userid,
    );
  }

  @Delete('tax-brackets/:bracketId')
  @UseGuards(RolesGuard)
  @Roles(...SYSTEM_ADMIN_ONLY)
  @ApiOperation({ summary: 'Delete a tax bracket' })
  @ApiResponse({
    status: 200,
    description: 'Tax bracket deleted',
  })
  deleteTaxBracket(
    @Param('bracketId') bracketId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.cnbService.deleteTaxBracket(
      bracketId,
      req.user.company_id,
      req.user.sub_userid,
    );
  }

  @Patch('payslips/:payslipId/review')
  @UseGuards(RolesGuard)
  @Roles(...CNB_OFFICER_AND_ADMIN)
  @ApiOperation({ summary: 'Review and approve/reject a payslip' })
  @ApiResponse({
    status: 200,
    description: 'Payslip reviewed',
  })
  reviewPayslip(
    @Param('payslipId') payslipId: string,
    @Body() dto: { status: 'Approved' | 'Correction Needed' },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.cnbService.reviewPayslip(
      payslipId,
      dto.status,
      req.user.sub_userid,
      req.user.company_id,
    );
  }

  @Get('me/compensation')
  @ApiOperation({ summary: 'Get my compensation summary' })
  getMyCompensation(@Req() req: AuthenticatedRequest) {
    return this.cnbService.getMyCompensation(
      req.user.sub_userid,
      req.user.company_id,
    );
  }

  @Get('me/payslips')
  @ApiOperation({ summary: 'Get my payslips' })
  getMyPayslips(@Req() req: AuthenticatedRequest) {
    return this.cnbService.getMyPayslips(
      req.user.sub_userid,
      req.user.company_id,
    );
  }

  @Get('payslips/:payslipId')
  getPayslipDetail(
    @Param('payslipId') payslipId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.cnbService.getPayslipDetailForUser(payslipId, req.user);
  }

  @Get('compute/13th-month/:userId')
  @UseGuards(RolesGuard)
  @Roles(...CNB_OFFICER_AND_ADMIN)
  compute13thMonth(
    @Param('userId') userId: string,
    @Req() req: AuthenticatedRequest,
    @Query('year') year?: string,
  ) {
    const parsedYear = year ? Number(year) : new Date().getFullYear();
    return this.cnbService.compute13thMonthPay(
      userId,
      req.user.company_id,
      parsedYear,
    );
  }

  @Get('me/compute/13th-month')
  compute13thMonthSelf(
    @Req() req: AuthenticatedRequest,
    @Query('year') year?: string,
  ) {
    const parsedYear = year ? Number(year) : new Date().getFullYear();
    return this.cnbService.compute13thMonthPay(
      req.user.sub_userid,
      req.user.company_id,
      parsedYear,
    );
  }

  // ── PAYROLL COMPUTATION ────────────────────────────────────────

  @Get('salary-baselines/:userId/annualization')
  @UseGuards(RolesGuard)
  @Roles(...CNB_OFFICER_AND_ADMIN)
  @ApiOperation({ summary: 'Compute annualized salary growth schedule for an employee' })
  computeSalaryAnnualization(
    @Param('userId') userId: string,
    @Req() req: AuthenticatedRequest,
    @Query('annual_rate_percent') annualRatePercent?: string,
    @Query('years') years?: string,
    @Query('start_year') startYear?: string,
  ) {
    return this.cnbService.computeSalaryAnnualization(
      userId,
      req.user.company_id,
      annualRatePercent ? Number(annualRatePercent) : 0,
      years ? Number(years) : 5,
      startYear ? Number(startYear) : undefined,
    );
  }

  @Post('payroll/run')
  @UseGuards(RolesGuard)
  @Roles(...CNB_OFFICER_AND_ADMIN)
  runPayrollCutoff(
    @Req() req: AuthenticatedRequest,
    @Body()
    dto: {
      cutoff_start_date: string;
      cutoff_end_date: string;
      payout_date: string;
    },
  ) {
    return this.cnbService.runPayrollCutoff(
      req.user.company_id,
      dto.cutoff_start_date,
      dto.cutoff_end_date,
      dto.payout_date,
      req.user.sub_userid,
    );
  }

  @Get('payroll/periods')
  @UseGuards(RolesGuard)
  @Roles(...CNB_OFFICER_AND_ADMIN)
  getPayrollPeriods(@Req() req: AuthenticatedRequest) {
    return this.cnbService.getPayrollPeriods(req.user.company_id);
  }

  @Get('payroll/periods/:periodId/payslips')
  @UseGuards(RolesGuard)
  @Roles(...CNB_OFFICER_AND_ADMIN)
  getPayslipsForPeriod(
    @Param('periodId') periodId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.cnbService.getPayslipsForPeriod(periodId, req.user.company_id);
  }

  @Post('payroll/compute/:userId')
  @UseGuards(RolesGuard)
  @Roles(...CNB_OFFICER_AND_ADMIN)
  computeSinglePayslip(
    @Param('userId') userId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: { period_id: string },
  ) {
    return this.cnbService.computeEmployeePayslip(
      userId,
      req.user.company_id,
      dto.period_id,
      req.user.sub_userid,
    );
  }

  // ── Annual net pay ─────────────────────────────────────────────

  @Get('me/annual-pay')
  @ApiOperation({ summary: 'Get my total net pay for the year (aggregated from all payslips)' })
  getMyAnnualPay(
    @Req() req: AuthenticatedRequest,
    @Query('year') year?: string,
  ) {
    const parsedYear = year ? Number(year) : new Date().getFullYear();
    return this.cnbService.getAnnualNetPay(req.user.sub_userid, req.user.company_id, parsedYear);
  }

  @Get('annual-pay/:userId')
  @UseGuards(RolesGuard)
  @Roles(...CNB_OFFICER_AND_ADMIN)
  @ApiOperation({ summary: 'Get total net pay for an employee for the year' })
  getEmployeeAnnualPay(
    @Param('userId') userId: string,
    @Req() req: AuthenticatedRequest,
    @Query('year') year?: string,
  ) {
    const parsedYear = year ? Number(year) : new Date().getFullYear();
    return this.cnbService.getAnnualNetPay(userId, req.user.company_id, parsedYear);
  }

  // ── Annualization batch ────────────────────────────────────────

  @Post('salary-baselines/annualize/batch')
  @UseGuards(RolesGuard)
  @Roles(...CNB_OFFICER_AND_ADMIN)
  @ApiOperation({
    summary: 'Apply annual salary increase (%) to all employees in the company',
    description: 'Inserts new salary baseline rows with the increased salary effective on the given date. Uses compound growth from the current baseline.',
  })
  applyAnnualizationBatch(
    @Req() req: AuthenticatedRequest,
    @Body() dto: {
      annual_rate_percent: number;
      effective_date: string;
      employee_ids?: string[];
    },
  ) {
    return this.cnbService.applyAnnualizationBatch(
      req.user.company_id,
      dto.annual_rate_percent,
      dto.effective_date,
      req.user.sub_userid,
      dto.employee_ids,
    );
  }

  // ── Retirement benefit ────────────────────────────────────────

  @Get('compute/retirement/:userId')
  @UseGuards(RolesGuard)
  @Roles(...CNB_OFFICER_AND_ADMIN)
  @ApiOperation({
    summary: 'Compute retirement benefit for an employee',
    description: 'Returns RA 7641 statutory amount vs company policy amount, uses the higher of the two. Requires a benefit of type "retirement" in the benefits catalog for company policy computation.',
  })
  computeRetirement(
    @Param('userId') userId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.cnbService.computeRetirementBenefit(userId, req.user.company_id);
  }

  @Get('me/compute/retirement')
  @ApiOperation({ summary: 'Compute my retirement benefit' })
  computeRetirementSelf(@Req() req: AuthenticatedRequest) {
    return this.cnbService.computeRetirementBenefit(req.user.sub_userid, req.user.company_id);
  }

  // ── Company branding ──────────────────────────────────────────

  @Get('company/branding')
  @ApiOperation({ summary: 'Get company logo, display name, and brand color' })
  getCompanyBranding(@Req() req: AuthenticatedRequest) {
    return this.cnbService.getCompanyBranding(req.user.company_id);
  }

  @Patch('company/branding')
  @UseGuards(RolesGuard)
  @Roles(...SYSTEM_ADMIN_ONLY)
  @ApiOperation({ summary: 'Update company logo URL, display name, or brand color' })
  updateCompanyBranding(
    @Req() req: AuthenticatedRequest,
    @Body() dto: { logo_url?: string; display_name?: string; primary_color?: string },
  ) {
    return this.cnbService.updateCompanyBranding(req.user.company_id, dto, req.user.sub_userid);
  }

}
