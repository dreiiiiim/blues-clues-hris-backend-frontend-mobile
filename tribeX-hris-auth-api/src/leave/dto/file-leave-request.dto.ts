import {
  IsString,
  IsOptional,
  IsIn,
  IsDateString,
  IsNotEmpty,
  IsBoolean,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export const LEAVE_TYPES = [
  'Vacation Leave',
  'Sick Leave',
  'Emergency Leave',
  'Personal Leave',
  'WFH / Remote',
  'Other',
] as const;

// Leave types that are allowed for retro-filing (backdated)
export const RETRO_ELIGIBLE_LEAVE_TYPES: string[] = ['Sick Leave', 'Emergency Leave'];

export type LeaveType = (typeof LEAVE_TYPES)[number];

export class FileLeaveRequestDto {
  @IsString({ message: 'leave_type must be a string' })
  @IsIn([...LEAVE_TYPES], {
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

  /** Set to true to file a leave request for dates in the past (retro-filing).
   *  Only allowed for Sick Leave and Emergency Leave.
   *  retro_reason is required when is_retro is true. */
  @IsOptional()
  @IsBoolean({ message: 'is_retro must be a boolean' })
  is_retro?: boolean;

  @ValidateIf((o) => o.is_retro === true)
  @IsString({ message: 'retro_reason must be a string' })
  @IsNotEmpty({ message: 'retro_reason is required when filing a retro leave request' })
  @MaxLength(500, { message: 'retro_reason must not exceed 500 characters' })
  retro_reason?: string;
}
