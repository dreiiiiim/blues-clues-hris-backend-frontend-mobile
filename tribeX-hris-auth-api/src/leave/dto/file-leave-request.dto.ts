import {
  IsString,
  IsOptional,
  IsIn,
  IsDateString,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';

export const LEAVE_TYPES = [
  'Vacation Leave',
  'Sick Leave',
  'Emergency Leave',
  'Personal Leave',
  'WFH / Remote',
  'Other',
] as const;

export type LeaveType = (typeof LEAVE_TYPES)[number];

export class FileLeaveRequestDto {
  @IsString({ message: 'leave_type must be a string' })
  @IsIn(LEAVE_TYPES as unknown as string[], {
    message: `leave_type must be one of: ${LEAVE_TYPES.join(', ')}`,
  })
  @IsNotEmpty({ message: 'leave_type is required' })
  leave_type: LeaveType;

  @IsDateString(
    { strict: true },
    { message: 'start_date must be in ISO 8601 format (YYYY-MM-DD)' },
  )
  @IsNotEmpty({ message: 'start_date is required' })
  start_date: string; // YYYY-MM-DD

  @IsDateString(
    { strict: true },
    { message: 'end_date must be in ISO 8601 format (YYYY-MM-DD)' },
  )
  @IsNotEmpty({ message: 'end_date is required' })
  end_date: string; // YYYY-MM-DD

  @IsOptional()
  @IsString({ message: 'reason must be a string' })
  @MaxLength(500, { message: 'reason must not exceed 500 characters' })
  reason?: string;

  @IsOptional()
  @IsString({ message: 'attachment_url must be a string' })
  attachment_url?: string;
}
