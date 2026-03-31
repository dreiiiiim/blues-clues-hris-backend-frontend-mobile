import { Module } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { HrOnboardingController } from './hr-onboarding.controller';
import { ApplicantOnboardingController } from './applicant-onboarding.controller';
import { AdminOnboardingController } from './admin-onboarding.controller';
import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [AuthModule, SupabaseModule],
  controllers: [
    ApplicantOnboardingController,
    HrOnboardingController,
    AdminOnboardingController,
  ],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
