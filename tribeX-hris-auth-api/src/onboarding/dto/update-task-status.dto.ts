import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsOptional } from 'class-validator';

export enum ItemStatusEnum {
  PENDING = 'pending',
  SUBMITTED = 'submitted',
  FOR_REVIEW = 'for-review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ISSUED = 'issued',
  CONFIRMED = 'confirmed',
}

export class UpdateTaskStatusDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  remarks?: string;

  @ApiProperty({ enum: ItemStatusEnum })
  @IsEnum(ItemStatusEnum)
  status: ItemStatusEnum;
}
