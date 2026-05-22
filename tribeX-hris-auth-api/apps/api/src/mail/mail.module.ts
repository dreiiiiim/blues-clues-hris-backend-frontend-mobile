import { Module, forwardRef } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailController } from './mail.controller';
import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '@app/supabase';
import { ApiCenterSdkModule } from '@app/api-center';

@Module({
  imports: [forwardRef(() => AuthModule), SupabaseModule, ApiCenterSdkModule],
  controllers: [MailController],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
