import { Module } from '@nestjs/common';
import { ApiCenterSdkModule } from '../api-center/api-center-sdk.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [SupabaseModule, ApiCenterSdkModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
