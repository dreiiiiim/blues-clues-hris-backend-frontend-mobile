import { IsString, IsOptional, IsIn, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const VALID_APPLICATION_STATUSES = [
  'submitted',
  'screening',
  'first_interview',
  'technical_interview',
  'final_interview',
  'hired',
  'rejected',
  'withdrawn',
] as const;

export type ApplicationStatus = typeof VALID_APPLICATION_STATUSES[number];

export class UpdateApplicationStatusDto {
  @ApiProperty({
    description: 'New status for the application',
    example: 'screening',
    enum: VALID_APPLICATION_STATUSES,
  })
  @IsString()
  @IsIn(VALID_APPLICATION_STATUSES as unknown as string[])
  status: ApplicationStatus;

  @ApiPropertyOptional({
    description: 'Reason for rejection (required when status is rejected)',
    example: 'Skills Mismatch',
  })
  @IsString()
  @IsOptional()
  rejection_reason?: string;

  @ApiPropertyOptional({
    description: 'Days until offer acceptance deadline (only used when status is "hired", default 7)',
    example: 7,
    minimum: 1,
    maximum: 90,
  })
  @IsInt()
  @Min(1)
  @Max(90)
  @IsOptional()
  offer_deadline_days?: number;
}
