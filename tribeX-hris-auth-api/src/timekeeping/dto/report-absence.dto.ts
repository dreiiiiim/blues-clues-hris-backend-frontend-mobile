import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  IsNumber,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum AbsenceReason {
  SICK      = 'Sick Leave',
  EMERGENCY = 'Emergency Leave',
  WFH       = 'WFH / Remote',
  PERSONAL  = 'Personal Leave',
  VACATION  = 'Vacation Leave',
  APPROVED  = 'On Leave (Approved)',
  OTHER     = 'Other',
}

export class ReportAbsenceDto {
  @ApiProperty({ enum: AbsenceReason, description: 'Reason for absence' })
  @IsEnum(AbsenceReason)
  reason: AbsenceReason;

  @ApiProperty({
    description: 'GPS latitude coordinate (required)',
    example: 14.5995,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({
    description: 'GPS longitude coordinate (required)',
    example: 120.9842,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiPropertyOptional({
    description: 'Absence start date in YYYY-MM-DD format. Defaults to today in Manila.',
    example: '2026-04-26',
  })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional({
    description: 'Absence end date in YYYY-MM-DD format. Defaults to date_from.',
    example: '2026-04-28',
  })
  @IsOptional()
  @IsDateString()
  date_to?: string;

  @ApiPropertyOptional({ description: 'Optional additional notes', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
