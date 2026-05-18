import { IsEnum, IsString, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum OvertimeReviewAction {
  APPROVE = 'approve',
  DENY    = 'deny',
}

export class ReviewOvertimeRequestDto {
  @ApiProperty({ enum: OvertimeReviewAction })
  @IsEnum(OvertimeReviewAction)
  action: OvertimeReviewAction;

  @ApiPropertyOptional({ description: 'Required when denying (min 3 chars)', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  review_reason?: string;
}
