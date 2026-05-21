import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum OvertimeType {
  NORMAL = 'NORMAL',
  REST_DAY = 'REST_DAY',
  HOLIDAY = 'HOLIDAY',
}

export class FileOvertimeRequestDto {
  @ApiProperty({ enum: OvertimeType })
  @IsEnum(OvertimeType)
  ot_type: OvertimeType;

  @ApiProperty({ example: '2026-05-20' })
  @IsDateString({ strict: true }, { message: 'ot_date must be YYYY-MM-DD' })
  @IsNotEmpty()
  ot_date: string;

  @ApiProperty({ example: '18:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'start_time must be HH:MM (24-hour)' })
  start_time: string;

  @ApiProperty({ example: '21:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'end_time must be HH:MM (24-hour)' })
  end_time: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
