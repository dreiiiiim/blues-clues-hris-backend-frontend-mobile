import {
  IsEnum,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum OvertimeType {
  NORMAL   = 'NORMAL',
  REST_DAY = 'REST_DAY',
  HOLIDAY  = 'HOLIDAY',
}

export class FileOvertimeRequestDto {
  @ApiProperty({ enum: OvertimeType, description: 'NORMAL = workday OT, REST_DAY = rest-day OT, HOLIDAY = holiday OT' })
  @IsEnum(OvertimeType)
  ot_type: OvertimeType;

  @ApiProperty({ example: '2026-05-20', description: 'Date of overtime — must be a future date' })
  @IsDateString({ strict: true }, { message: 'ot_date must be YYYY-MM-DD' })
  @IsNotEmpty()
  ot_date: string;

  @ApiProperty({ example: '18:00', description: 'Start time in HH:MM (24-hour)' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'start_time must be HH:MM (24-hour)' })
  start_time: string;

  @ApiProperty({ example: '21:00', description: 'End time in HH:MM (24-hour) — must be after start_time' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'end_time must be HH:MM (24-hour)' })
  end_time: string;

  @ApiProperty({ description: 'GPS latitude (required)' })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({ description: 'GPS longitude (required)' })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiPropertyOptional({ description: 'Reason for overtime request', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
