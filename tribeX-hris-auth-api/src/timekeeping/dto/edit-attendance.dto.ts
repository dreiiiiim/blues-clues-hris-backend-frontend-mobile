import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator';

const CLOCK_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ATTENDANCE_STATUS_ACTIONS = ['clocked-in', 'present', 'excused', 'absent'] as const;

export class EditAttendanceDto {
  @ApiPropertyOptional({
    description: 'Clock-in time in 24-hour HH:mm format.',
    example: '08:45',
  })
  @IsOptional()
  @IsString()
  @Matches(CLOCK_REGEX, { message: 'time_in must be in HH:mm format.' })
  time_in?: string;

  @ApiPropertyOptional({
    description: 'Clock-out time in 24-hour HH:mm format.',
    example: '17:32',
  })
  @IsOptional()
  @IsString()
  @Matches(CLOCK_REGEX, { message: 'time_out must be in HH:mm format.' })
  time_out?: string;

  @ApiPropertyOptional({
    description: 'Optional HR quick action for common attendance corrections.',
    enum: ATTENDANCE_STATUS_ACTIONS,
    example: 'excused',
  })
  @IsOptional()
  @IsString()
  @IsIn(ATTENDANCE_STATUS_ACTIONS)
  attendance_status?: (typeof ATTENDANCE_STATUS_ACTIONS)[number];

  @ApiPropertyOptional({
    description: 'Optional absence/excuse reason for HR quick actions.',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  absence_reason?: string;

  @ApiProperty({
    description: 'Required reason for the attendance correction.',
    maxLength: 500,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  edit_reason: string;
}
