import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '@app/supabase';
import { MailModule } from '../mail/mail.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TimekeepingModule } from '../timekeeping/timekeeping.module';
import { LeaveBalancesModule } from '../leave-balances/leave-balances.module';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  imports: [AuthModule, SupabaseModule, MailModule, AuditModule, NotificationsModule, TimekeepingModule, LeaveBalancesModule],
})
export class UsersModule {}
