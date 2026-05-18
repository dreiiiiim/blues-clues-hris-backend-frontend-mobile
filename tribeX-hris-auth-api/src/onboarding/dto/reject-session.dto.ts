import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RejectSessionDto {
  @ApiProperty({ description: 'Reason for rejecting the full onboarding session' })
  @IsString()
  @MinLength(1)
  reason: string;
}

