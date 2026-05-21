import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateBenefitCatalogDto {
  @IsOptional()
  @IsString({ message: 'benefit_name must be a string' })
  @MinLength(1, { message: 'benefit_name must not be empty' })
  @MaxLength(100, { message: 'benefit_name must not exceed 100 characters' })
  benefit_name?: string;

  @IsOptional()
  @IsString({ message: 'benefit_type must be a string' })
  @MinLength(1, { message: 'benefit_type must not be empty' })
  @MaxLength(50, { message: 'benefit_type must not exceed 50 characters' })
  benefit_type?: string;

  @IsOptional()
  @IsBoolean({ message: 'taxable must be a boolean' })
  taxable?: boolean;

  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'default_amount must be a number with at most 2 decimal places' },
  )
  @Min(0, { message: 'default_amount must be greater than or equal to 0' })
  default_amount?: number;

  @IsOptional()
  @IsBoolean({ message: 'is_active must be a boolean' })
  is_active?: boolean;
}
