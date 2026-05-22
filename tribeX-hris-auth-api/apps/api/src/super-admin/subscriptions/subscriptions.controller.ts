import { Controller, Get, Patch, Param, Query, Body, UseGuards, Req } from '@nestjs/common';
import { SuperAdminGuard } from '../super-admin.guard';
import { SuperAdminSubscriptionsService } from './subscriptions.service';
import { UpdateSubscriptionStatusDto } from './dto/update-subscription-status.dto';

@Controller('super-admin/subscriptions')
@UseGuards(SuperAdminGuard)
export class SuperAdminSubscriptionsController {
  constructor(private readonly service: SuperAdminSubscriptionsService) {}

  @Get()
  list(@Query() query: Record<string, any>) {
    return this.service.list({
      status: query.status, billing_cycle: query.billing_cycle,
      page: query.page ? +query.page : 1, limit: query.limit ? +query.limit : 20,
    });
  }

  @Get(':registration_id')
  detail(@Param('registration_id') id: string) { return this.service.detail(id); }

  @Patch(':registration_id/status')
  updateStatus(@Param('registration_id') id: string, @Body() dto: UpdateSubscriptionStatusDto, @Req() req: any) {
    return this.service.updateStatus(id, dto.subscription_status, req.user.sub);
  }

  @Get(':registration_id/payment-history')
  paymentHistory(@Param('registration_id') id: string) { return this.service.paymentHistory(id); }
}
