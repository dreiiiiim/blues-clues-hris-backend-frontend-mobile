import { IsEnum, IsNumber, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { LeaveCategory } from '../leave-categories';

export class CompanyDefaultItemDto {
  @ApiProperty({ enum: LeaveCategory })
  @IsEnum(LeaveCategory)
  leave_category: LeaveCategory;

  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @Min(0)
  default_days: number;
}

export class CompanyDefaultLeaveBalancesDto {
  @ApiProperty({ type: [CompanyDefaultItemDto] })
  @ValidateNested({ each: true })
  @Type(() => CompanyDefaultItemDto)
  items: CompanyDefaultItemDto[];
}
