import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CnbModule } from '../cnb/cnb.module';
import { SupabaseModule } from '@app/supabase';
import { PerformanceController } from './performance.controller';
import { PerformanceService } from './performance.service';

@Module({
  imports: [AuthModule, SupabaseModule, CnbModule],
  controllers: [PerformanceController],
  providers: [PerformanceService],
})
export class PerformanceModule {}
