import {
  IsNumber,
  Min,
  Max,
  IsNotEmpty,
} from 'class-validator';

export class SetTaxBracketDto {
  @IsNumber()
  @Min(2000, { message: 'effective_year must be 2000 or later' })
  @Max(2099, { message: 'effective_year must be 2099 or earlier' })
  @IsNotEmpty({ message: 'effective_year is required' })
  effective_year: number;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'min_salary must be a number with at most 2 decimal places' },
  )
  @Min(0, { message: 'min_salary must be greater than or equal to 0' })
  @IsNotEmpty({ message: 'min_salary is required' })
  min_salary: number;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'max_salary must be a number with at most 2 decimal places' },
  )
  @Min(0, { message: 'max_salary must be greater than or equal to 0' })
  @IsNotEmpty({ message: 'max_salary is required' })
  max_salary: number;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'base_tax_amount must be a number with at most 2 decimal places' },
  )
  @Min(0, { message: 'base_tax_amount must be greater than or equal to 0' })
  @IsNotEmpty({ message: 'base_tax_amount is required' })
  base_tax_amount: number;

  @IsNumber(
    { maxDecimalPlaces: 4 },
    { message: 'excess_percentage must be a number with at most 4 decimal places' },
  )
  @Min(0, { message: 'excess_percentage must be greater than or equal to 0' })
  @Max(100, { message: 'excess_percentage must be 100 or less (e.g. use 15 for 15%)' })
  @IsNotEmpty({ message: 'excess_percentage is required' })
  excess_percentage: number;
}
