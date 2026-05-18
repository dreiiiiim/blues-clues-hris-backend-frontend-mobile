import {
  IsNotEmpty,
  IsString,
  IsBoolean,
  MaxLength,
  MinLength,
  IsNumber,
  Min,
} from 'class-validator';

export class CreateBenefitDto {
  @IsString({ message: 'benefit_name must be a string' })
  @IsNotEmpty({ message: 'benefit_name is required' })
  @MinLength(1, { message: 'benefit_name must not be empty' })
  @MaxLength(100, { message: 'benefit_name must not exceed 100 characters' })
  benefit_name: string;

  @IsString({ message: 'benefit_type must be a string' })
  @IsNotEmpty({ message: 'benefit_type is required' })
  @MinLength(1, { message: 'benefit_type must not be empty' })
  @MaxLength(50, { message: 'benefit_type must not exceed 50 characters' })
  benefit_type: string;

  @IsBoolean({ message: 'taxable must be a boolean' })
  @IsNotEmpty({ message: 'taxable is required' })
  taxable: boolean;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'default_amount must be a number with at most 2 decimal places' },
  )
  @Min(0, { message: 'default_amount must be greater than or equal to 0' })
  @IsNotEmpty({ message: 'default_amount is required' })
  default_amount: number;
}
