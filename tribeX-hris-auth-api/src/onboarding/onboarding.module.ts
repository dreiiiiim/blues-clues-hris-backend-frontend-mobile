import { Module } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { HrOnboardingController } from './hr-onboarding.controller';
import { ApplicantOnboardingController } from './applicant-onboarding.controller';
import { AdminOnboardingController } from './admin-onboarding.controller';
import { NewHireController } from './new-hire.controller';
import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [AuthModule, SupabaseModule, MailModule],
  controllers: [
    ApplicantOnboardingController,
    HrOnboardingController,
    AdminOnboardingController,
    NewHireController,
  ],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
