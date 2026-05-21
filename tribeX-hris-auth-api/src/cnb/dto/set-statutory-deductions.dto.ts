import { IsIn, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class StatutoryRateDto {
  @ApiProperty({ enum: ['percentage', 'fixed_amount'] })
  @IsIn(['percentage', 'fixed_amount'])
  type: 'percentage' | 'fixed_amount';

  @ApiProperty({ description: 'Percentage (0-100) or fixed PHP amount' })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  value: number;
}

export class SetStatutoryDeductionsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => StatutoryRateDto)
  sss?: StatutoryRateDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => StatutoryRateDto)
  philhealth?: StatutoryRateDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => StatutoryRateDto)
  pagibig?: StatutoryRateDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
