import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class ScheduleEffectiveDateDto {
  @ApiPropertyOptional({
    description: 'Effectivity date in YYYY-MM-DD format. Defaults to current Manila date when omitted.',
    example: '2026-04-23',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'effective_date must be in YYYY-MM-DD format',
  })
  effective_date?: string;
}
