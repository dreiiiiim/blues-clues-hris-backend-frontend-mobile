import { Module } from '@nestjs/common';
import { ApiCenterSdkModule } from '@app/api-center';
import { MailModule } from '../mail/mail.module';
import { SupabaseModule } from '@app/supabase';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';

@Module({
  imports: [SupabaseModule, MailModule, ApiCenterSdkModule],
  controllers: [SubscriptionController],
  providers: [SubscriptionService],
})
export class SubscriptionModule {}
