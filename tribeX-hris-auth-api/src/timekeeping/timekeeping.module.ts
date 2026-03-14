import { Module } from '@nestjs/common';
import { TimekeepingController } from './timekeeping.controller';
import { TimekeepingService } from './timekeeping.service';
import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '../supabase/supabase.module';


@Module({
  imports: [AuthModule, SupabaseModule],
  controllers: [TimekeepingController],
  providers: [TimekeepingService],
  exports: [TimekeepingService],
})
export class TimekeepingModule {}










