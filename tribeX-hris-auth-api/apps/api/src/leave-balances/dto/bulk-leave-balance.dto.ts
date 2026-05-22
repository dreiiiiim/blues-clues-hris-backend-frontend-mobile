import {
  IsEnum,
  IsNumber,
  IsString,
  IsOptional,
  IsArray,
  Min,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeaveCategory } from '../leave-categories';

export class BulkLeaveItemDto {
  @ApiProperty({ enum: LeaveCategory })
  @IsEnum(LeaveCategory)
  leave_category: LeaveCategory;

  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @Min(0)
  entitled_days: number;
}

export class BulkLeaveBalanceDto {
  @ApiProperty({ enum: ['company', 'department', 'employees'] })
  @IsIn(['company', 'department', 'employees'])
  scope: 'company' | 'department' | 'employees';

  @ApiPropertyOptional({ description: 'Required when scope=department' })
  @IsOptional()
  @IsString()
  department_id?: string;

  @ApiPropertyOptional({ description: 'Required when scope=employees', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  user_ids?: string[];

  @ApiProperty({ type: [BulkLeaveItemDto] })
  @ValidateNested({ each: true })
  @Type(() => BulkLeaveItemDto)
  items: BulkLeaveItemDto[];
}
