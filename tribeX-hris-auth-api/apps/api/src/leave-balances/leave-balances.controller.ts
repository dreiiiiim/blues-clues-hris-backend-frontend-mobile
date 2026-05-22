import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';
import { LeaveBalancesService } from './leave-balances.service';
import { UpsertEmployeeLeaveBalancesDto } from './dto/upsert-employee-leave-balances.dto';
import { CompanyDefaultLeaveBalancesDto } from './dto/company-default-leave-balances.dto';
import { BulkLeaveBalanceDto } from './dto/bulk-leave-balance.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest } from '@app/common';

const LEAVE_BALANCE_MANAGERS = ['System Admin', 'HR Officer', 'HR Recruiter', 'HR Interviewer', 'Manager'];
const HR_AND_ABOVE = ['Admin', 'System Admin', 'HR Officer', 'HR Recruiter', 'HR Interviewer', 'Manager'];

@ApiTags('Leave Balances')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('leave-balances')
export class LeaveBalancesController {
  constructor(private readonly leaveBalancesService: LeaveBalancesService) {}

  // ── Self ─────────────────────────────────────────────────────────────────────

  @Get('my')
  @ApiOperation({ summary: 'Employee: Get my own leave balances' })
  getMyBalances(@Req() req: AuthenticatedRequest) {
    return this.leaveBalancesService.getMyBalances(req.user.sub_userid);
  }

  // ── Company defaults ─────────────────────────────────────────────────────────

  @Get('company-default')
  @UseGuards(RolesGuard)
  @Roles(...HR_AND_ABOVE)
  @ApiOperation({ summary: 'HR: Get company-wide leave defaults' })
  getCompanyDefaults(@Req() req: AuthenticatedRequest) {
    return this.leaveBalancesService.getCompanyDefaults(req.user.company_id);
  }

  @Put('company-default')
  @UseGuards(RolesGuard)
  @Roles(...LEAVE_BALANCE_MANAGERS)
  @ApiOperation({ summary: 'HR/Manager: Set company-wide leave defaults' })
  upsertCompanyDefaults(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CompanyDefaultLeaveBalancesDto,
  ) {
    return this.leaveBalancesService.upsertCompanyDefaults(
      req.user.company_id,
      dto,
      req.user.sub_userid,
    );
  }

  @Get('departments/:departmentId/default')
  @UseGuards(RolesGuard)
  @Roles(...HR_AND_ABOVE)
  @ApiParam({ name: 'departmentId' })
  @ApiOperation({ summary: 'HR: Get department leave defaults' })
  getDepartmentDefaults(
    @Param('departmentId') departmentId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.leaveBalancesService.getDepartmentDefaults(
      req.user.company_id,
      departmentId,
    );
  }

  @Put('departments/:departmentId/default')
  @UseGuards(RolesGuard)
  @Roles(...LEAVE_BALANCE_MANAGERS)
  @ApiParam({ name: 'departmentId' })
  @ApiOperation({ summary: 'HR/Manager: Set department leave defaults' })
  upsertDepartmentDefaults(
    @Param('departmentId') departmentId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: CompanyDefaultLeaveBalancesDto,
  ) {
    return this.leaveBalancesService.upsertDepartmentDefaults(
      req.user.company_id,
      departmentId,
      dto,
      req.user.sub_userid,
    );
  }

  @Post('company-default/backfill')
  @UseGuards(RolesGuard)
  @Roles(...LEAVE_BALANCE_MANAGERS)
  @ApiOperation({ summary: 'HR/Manager: Apply defaults to employees with no balance rows' })
  backfillCompanyDefaults(@Req() req: AuthenticatedRequest) {
    return this.leaveBalancesService.backfillCompanyDefaults(
      req.user.company_id,
      req.user.sub_userid,
    );
  }

  @Post('reconcile')
  @UseGuards(RolesGuard)
  @Roles(...LEAVE_BALANCE_MANAGERS)
  @ApiOperation({ summary: 'HR/Manager: Reconcile all employee leave balances across policy + usage tables' })
  reconcileCompanyBalances(@Req() req: AuthenticatedRequest) {
    return this.leaveBalancesService.reconcileCompanyBalances(
      req.user.company_id,
      req.user.sub_userid,
    );
  }

  // ── Employee roster ─────────────────────────────────────────────────────────

  @Get('employees')
  @UseGuards(RolesGuard)
  @Roles(...HR_AND_ABOVE)
  @ApiOperation({ summary: 'HR: Get leave balance roster for all employees' })
  getRoster(@Req() req: AuthenticatedRequest) {
    return this.leaveBalancesService.getRoster(req.user.company_id);
  }

  @Get('employees/:userId')
  @UseGuards(RolesGuard)
  @Roles(...HR_AND_ABOVE)
  @ApiParam({ name: 'userId', description: 'user_id of the employee' })
  @ApiOperation({ summary: 'HR: Get leave balances for a specific employee' })
  getEmployeeBalances(
    @Param('userId') userId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.leaveBalancesService.getEmployeeBalances(userId, req.user.company_id);
  }

  @Put('employees/:userId')
  @UseGuards(RolesGuard)
  @Roles(...LEAVE_BALANCE_MANAGERS)
  @ApiParam({ name: 'userId', description: 'user_id of the employee' })
  @ApiOperation({ summary: 'HR/Manager: Set individual leave balances for an employee' })
  upsertEmployeeBalances(
    @Param('userId') userId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpsertEmployeeLeaveBalancesDto,
  ) {
    return this.leaveBalancesService.upsertEmployeeBalances(
      userId,
      req.user.company_id,
      dto,
      req.user.sub_userid,
    );
  }

  @Post('employees/:userId/reset-department')
  @UseGuards(RolesGuard)
  @Roles(...LEAVE_BALANCE_MANAGERS)
  @ApiParam({ name: 'userId' })
  @ApiOperation({ summary: 'HR/Manager: Reset employee balances to department baseline' })
  resetToDepartment(
    @Param('userId') userId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.leaveBalancesService.resetToDepartment(
      userId,
      req.user.company_id,
      req.user.sub_userid,
    );
  }

  @Post('employees/:userId/reset-company-default')
  @UseGuards(RolesGuard)
  @Roles(...LEAVE_BALANCE_MANAGERS)
  @ApiParam({ name: 'userId' })
  @ApiOperation({ summary: 'HR/Manager: Reset employee balances to company defaults' })
  resetToCompanyDefault(
    @Param('userId') userId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.leaveBalancesService.resetToCompanyDefault(
      userId,
      req.user.company_id,
      req.user.sub_userid,
    );
  }

  // ── Bulk ─────────────────────────────────────────────────────────────────────

  @Post('bulk')
  @UseGuards(RolesGuard)
  @Roles(...LEAVE_BALANCE_MANAGERS)
  @ApiOperation({ summary: 'HR/Manager: Bulk assign leave balances (company / department / employees)' })
  bulkAssign(@Req() req: AuthenticatedRequest, @Body() dto: BulkLeaveBalanceDto) {
    return this.leaveBalancesService.bulkAssign(
      req.user.company_id,
      dto,
      req.user.sub_userid,
    );
  }
}
