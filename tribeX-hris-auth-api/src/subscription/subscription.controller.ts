import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { PaymentConfirmDto } from './dto/payment-confirm.dto';
import { RegisterCompanyDto } from './dto/register-company.dto';
import { SelectPlanDto } from './dto/select-plan.dto';
import { SubscriptionService } from './subscription.service';

@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get('plans')
  getPlans() {
    return this.subscriptionService.getPlans();
  }

  @UseGuards(ThrottlerGuard)
  @Post('register')
  register(@Body() dto: RegisterCompanyDto) {
    return this.subscriptionService.register(dto);
  }

  @Post('select-plan')
  selectPlan(@Body() dto: SelectPlanDto) {
    return this.subscriptionService.selectPlan(dto);
  }

  @Post('payment/confirm')
  confirmPayment(
    @Body() dto: PaymentConfirmDto,
    @Headers('x-webhook-secret') secret: string,
  ) {
    return this.subscriptionService.confirmPayment(dto, secret);
  }

  @Get('registration/:id/status')
  getStatus(@Param('id') id: string) {
    return this.subscriptionService.getRegistrationStatus(id);
  }
}
