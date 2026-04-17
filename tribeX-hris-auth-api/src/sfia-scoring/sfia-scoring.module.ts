import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { SfiaScoringService } from './sfia-scoring.service';

@Module({
  imports: [SupabaseModule],
  providers: [SfiaScoringService],
  exports: [SfiaScoringService],
})
export class SfiaScoringModule {}
