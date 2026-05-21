import { IsEnum, IsNumber, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { LeaveCategory } from '../leave-categories';

export class LeaveBalanceItemDto {
  @ApiProperty({ enum: LeaveCategory })
  @IsEnum(LeaveCategory)
  leave_category: LeaveCategory;

  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @Min(0)
  entitled_days: number;
}

export class UpsertEmployeeLeaveBalancesDto {
  @ApiProperty({ type: [LeaveBalanceItemDto] })
  @ValidateNested({ each: true })
  @Type(() => LeaveBalanceItemDto)
  items: LeaveBalanceItemDto[];
}
