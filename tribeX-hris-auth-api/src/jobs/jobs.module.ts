import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuditModule } from '../audit/audit.module';
import { MailModule } from '../mail/mail.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SfiaScoringModule } from '../sfia-scoring/sfia-scoring.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

@Module({
  imports: [AuthModule, SupabaseModule, AuditModule, MailModule, OnboardingModule, NotificationsModule, SfiaScoringModule],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
