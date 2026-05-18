import { Module } from '@nestjs/common';
import { LeaveBalancesController } from './leave-balances.controller';
import { LeaveBalancesService } from './leave-balances.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [SupabaseModule, AuthModule],
  controllers: [LeaveBalancesController],
  providers: [LeaveBalancesService],
  exports: [LeaveBalancesService],
})
export class LeaveBalancesModule {}
