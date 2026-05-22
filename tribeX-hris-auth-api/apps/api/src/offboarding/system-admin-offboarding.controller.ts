import { Controller, Post, Get, Patch, Delete, Param, Query, Req, UseGuards, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { OffboardingService } from './offboarding.service';
import type { AuthenticatedRequest } from '@app/common';
import { ConfigureChecklistTemplateDto } from './dto/configure-checklist-template.dto';

const SYSTEM_ADMIN_ONLY = ['System Admin'];

@ApiTags('System Admin Offboarding')
@ApiBearerAuth()
@Controller('offboarding/system-admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SystemAdminOffboardingController {
  constructor(private readonly offboardingService: OffboardingService) {}

  // Phase 1 — Enable offboarding module for a company tenant
  @Post('tenants/:companyId/enable')
  @Roles(...SYSTEM_ADMIN_ONLY)
  @ApiOperation({ summary: 'Enable offboarding module for a company tenant' })
  enable(@Param('companyId') companyId: string, @Req() req: AuthenticatedRequest) {
    return this.offboardingService.enableOffboardingModule(companyId, req.user.sub_userid);
  }

  // Disable offboarding module
  @Post('tenants/:companyId/disable')
  @Roles(...SYSTEM_ADMIN_ONLY)
  @ApiOperation({ summary: 'Disable offboarding module for a company tenant' })
  disable(@Param('companyId') companyId: string, @Req() req: AuthenticatedRequest) {
    return this.offboardingService.disableOffboardingModule(companyId, req.user.sub_userid);
  }

  // Phase 3 — View and audit offboarding activity logs across all tenants
  @Get('audit-logs')
  @Roles(...SYSTEM_ADMIN_ONLY)
  @ApiOperation({ summary: 'View offboarding activity logs across all tenants (Phase 3)' })
  getAuditLogs(
    @Query('company_id') company_id?: string,
    @Query('employee_id') employee_id?: string,
  ) {
    return this.offboardingService.getOffboardingAuditLogs({ company_id, employee_id });
  }

  @Post('tenants/:companyId/checklist-templates')
  @Roles(...SYSTEM_ADMIN_ONLY)
  @ApiOperation({ summary: 'Configure offboarding checklist template for a tenant as System Admin' })
  configureTemplate(
    @Param('companyId') companyId: string,
    @Body() dto: ConfigureChecklistTemplateDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.offboardingService.configureChecklistTemplate(
      dto,
      companyId,
      req.user.sub_userid,
    );
  }

  @Get('tenants/:companyId/checklist-templates')
  @Roles(...SYSTEM_ADMIN_ONLY)
  @ApiOperation({ summary: 'Get offboarding checklist templates for a tenant as System Admin' })
  getTemplates(@Param('companyId') companyId: string) {
    return this.offboardingService.getChecklistTemplates(companyId);
  }

  @Get('tenants/:companyId/system-access-options')
  @Roles(...SYSTEM_ADMIN_ONLY)
  @ApiOperation({ summary: 'Get system access options for a tenant as System Admin' })
  getSystemAccessOptions(@Param('companyId') companyId: string) {
    return this.offboardingService.getSystemAccessOptions(companyId);
  }

  @Patch('tenants/:companyId/checklist-templates/:templateId')
  @Roles(...SYSTEM_ADMIN_ONLY)
  @ApiOperation({ summary: 'Update an offboarding checklist template for a tenant as System Admin' })
  updateTemplate(
    @Param('companyId') companyId: string,
    @Param('templateId') templateId: string,
    @Body() dto: ConfigureChecklistTemplateDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.offboardingService.updateChecklistTemplate(
      templateId,
      dto,
      companyId,
      req.user.sub_userid,
    );
  }

  @Delete('tenants/:companyId/checklist-templates/:templateId')
  @Roles(...SYSTEM_ADMIN_ONLY)
  @ApiOperation({ summary: 'Delete an offboarding checklist template for a tenant as System Admin' })
  deleteTemplate(
    @Param('companyId') companyId: string,
    @Param('templateId') templateId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.offboardingService.deleteChecklistTemplate(
      templateId,
      companyId,
      req.user.sub_userid,
    );
  }
}
