import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsNotEmpty, Min, Max, IsString, IsEnum } from 'class-validator';

export enum DeductionType {
  PERCENTAGE = 'percentage',
  FIXED_AMOUNT = 'fixed_amount',
}

/**
 * DTO for configuring statutory deductions per company
 * Can be set as percentages (e.g., 4.5% of gross) or fixed caps
 */
export class ConfigureStatutoryDeductionDto {
  @ApiProperty({
    description: 'Type: "percentage" (e.g., 4.5) or "fixed_amount" (e.g., 1350)',
    enum: DeductionType,
    example: 'percentage',
  })
  @IsEnum(DeductionType)
  type: DeductionType;

  @ApiProperty({
    description: 'Value: If percentage, enter as decimal (4.5 = 4.5%). If fixed_amount, enter in currency units',
    example: 4.5,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  value: number;
}

/**
 * DTO for configuring default amounts for statutory benefits per company
 * System Admin can set SSS, PhilHealth, PAG-IBIG as percentages or fixed caps
 */
export class ConfigureBenefitDefaultsDto {
  @ApiProperty({
    description: 'SSS (Social Security System) - set as percentage or fixed cap',
    type: ConfigureStatutoryDeductionDto,
    example: { type: 'percentage', value: 4.5 },
  })
  @IsOptional()
  sss?: ConfigureStatutoryDeductionDto;

  @ApiProperty({
    description: 'PhilHealth (Philippine Health Insurance) - set as percentage or fixed cap',
    type: ConfigureStatutoryDeductionDto,
    example: { type: 'fixed_amount', value: 1750 },
  })
  @IsOptional()
  philhealth?: ConfigureStatutoryDeductionDto;

  @ApiProperty({
    description: 'PAG-IBIG (Home Development Mutual Fund) - set as percentage or fixed cap',
    type: ConfigureStatutoryDeductionDto,
    example: { type: 'percentage', value: 2 },
  })
  @IsOptional()
  pagibig?: ConfigureStatutoryDeductionDto;

  @ApiProperty({
    description: 'Notes or description for this benefit configuration',
    example: 'Updated statutory deductions for 2026',
  })
  @IsString()
  @IsOptional()
  notes?: string;
}
