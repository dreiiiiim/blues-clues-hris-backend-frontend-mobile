import { Module } from '@nestjs/common';
import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';
import { LeaveAccrualService } from './leave-accrual.tasks';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { LeaveBalancesModule } from '../leave-balances/leave-balances.module';

@Module({
  imports: [SupabaseModule, AuthModule, MailModule, LeaveBalancesModule],
  controllers: [LeaveController],
  providers: [LeaveService, LeaveAccrualService],
  exports: [LeaveService],
})
export class LeaveModule {}
