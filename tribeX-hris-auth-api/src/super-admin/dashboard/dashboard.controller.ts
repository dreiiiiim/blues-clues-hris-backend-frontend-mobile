import { Controller, Get, UseGuards } from '@nestjs/common';
import { SuperAdminGuard } from '../super-admin.guard';
import { SuperAdminDashboardService } from './dashboard.service';

@Controller('super-admin/dashboard')
@UseGuards(SuperAdminGuard)
export class SuperAdminDashboardController {
  constructor(private readonly service: SuperAdminDashboardService) {}

  @Get('stats')
  stats() { return this.service.getStats(); }

  @Get('pending-approvals')
  pendingApprovals() { return this.service.getPendingApprovals(); }
}
