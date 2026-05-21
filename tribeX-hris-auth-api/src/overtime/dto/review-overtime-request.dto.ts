import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export enum OvertimeReviewAction {
  APPROVE = 'approve',
  DENY = 'deny',
}

export class ReviewOvertimeRequestDto {
  @ApiProperty({ enum: OvertimeReviewAction })
  @IsEnum(OvertimeReviewAction)
  action: OvertimeReviewAction;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  review_reason?: string;
}
