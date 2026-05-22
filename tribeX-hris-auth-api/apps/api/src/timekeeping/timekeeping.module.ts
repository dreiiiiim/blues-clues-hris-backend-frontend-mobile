import { Module } from '@nestjs/common';
import { TimekeepingController } from './timekeeping.controller';
import { TimekeepingService } from './timekeeping.service';
import { TimekeepingTasksService } from './timekeeping.tasks';
import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '@app/supabase';
import { MailModule } from '../mail/mail.module';
import { LeaveBalancesModule } from '../leave-balances/leave-balances.module';

@Module({
  imports: [
    AuthModule,
    SupabaseModule,
    MailModule,
    LeaveBalancesModule,
  ],
  controllers: [TimekeepingController],
  providers: [TimekeepingService, TimekeepingTasksService],
  exports: [TimekeepingService],
})
export class TimekeepingModule {}
