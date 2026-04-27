import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

export enum AbsenceReviewAction {
  APPROVE = 'approve',
  DENY = 'deny',
}

export class ReviewAbsenceDto {
  @ApiProperty({
    enum: AbsenceReviewAction,
    description: 'Review action to apply to the absence request.',
  })
  @IsEnum(AbsenceReviewAction)
  action: AbsenceReviewAction;

  @ApiProperty({
    description: 'Required reason for the approval/denial decision.',
    maxLength: 500,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  review_reason: string;
}

