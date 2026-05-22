import {
  IsUUID,
  IsEnum,
  IsNumber,
  Min,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export enum PayFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  SEMI_MONTHLY = 'semi-monthly',
}

export class SetSalaryBaselineDto {
  @IsUUID('4', { message: 'user_id must be a valid UUID' })
  @IsNotEmpty({ message: 'user_id is required' })
  user_id: string;

  @IsEnum(PayFrequency, {
    message: 'pay_frequency must be one of: daily, weekly, monthly, semi-monthly',
  })
  @IsNotEmpty({ message: 'pay_frequency is required' })
  pay_frequency: PayFrequency;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'basic_salary must be a number with at most 2 decimal places' },
  )
  @Min(0, { message: 'basic_salary must be greater than or equal to 0' })
  @IsNotEmpty({ message: 'basic_salary is required' })
  basic_salary: number;

  @IsDateString(
    { strict: true },
    { message: 'effective_date must be in ISO 8601 format (YYYY-MM-DD)' },
  )
  @IsNotEmpty({ message: 'effective_date is required' })
  effective_date: string;
}
