import { Module } from '@nestjs/common';
import { CnbController } from './cnb.controller';
import { CnbService } from './cnb.service';
import { CnbEncryptionService } from './cnb-encryption.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [SupabaseModule, AuthModule],
  controllers: [CnbController],
  providers: [CnbService, CnbEncryptionService],
  exports: [CnbService, CnbEncryptionService],
})
export class CnbModule {}
