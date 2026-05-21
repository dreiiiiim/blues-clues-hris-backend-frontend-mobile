import { Module } from '@nestjs/common';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';
import { CnbModule } from '../cnb/cnb.module';
import { TimekeepingModule } from '../timekeeping/timekeeping.module';
import { CnbEncryptionService } from '../cnb/cnb-encryption.service';

@Module({
  imports: [SupabaseModule, AuthModule, CnbModule, TimekeepingModule],
  controllers: [PayrollController],
  providers: [PayrollService, CnbEncryptionService],
  exports: [PayrollService],
})
export class PayrollModule {}
