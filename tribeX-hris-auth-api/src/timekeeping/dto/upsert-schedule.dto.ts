import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpsertScheduleDto {
  @ApiProperty({ description: 'Shift start time in HH:MM format', example: '09:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'start_time must be in HH:MM format' })
  start_time: string;

  @ApiProperty({ description: 'Shift end time in HH:MM format', example: '18:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'end_time must be in HH:MM format' })
  end_time: string;

  @ApiPropertyOptional({ description: 'Break start time in HH:MM format', example: '12:00' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'break_start must be in HH:MM format' })
  break_start?: string;

  @ApiPropertyOptional({ description: 'Break end time in HH:MM format', example: '13:00' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'break_end must be in HH:MM format' })
  break_end?: string;

  @ApiProperty({
    description: 'Comma-separated workday codes',
    example: 'MON,TUE,WED,THU,FRI',
  })
  @IsString()
  workdays: string;

  @ApiProperty({ description: 'Whether this is a night shift (crosses midnight)', example: false })
  @IsBoolean()
  is_nightshift: boolean;

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
