import {
  IsUUID,
  IsNumber,
  Min,
  IsDateString,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';

export class AssignBenefitDto {
  @IsUUID('4', { message: 'user_id must be a valid UUID' })
  @IsNotEmpty({ message: 'user_id is required' })
  user_id: string;

  @IsUUID('4', { message: 'benefit_id must be a valid UUID' })
  @IsNotEmpty({ message: 'benefit_id is required' })
  benefit_id: string;

  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'amount must be a number with at most 2 decimal places' },
  )
  @Min(0, { message: 'amount must be greater than or equal to 0' })
  amount?: number;

  @IsDateString(
    { strict: true },
    { message: 'effective_date must be in ISO 8601 format (YYYY-MM-DD)' },
  )
  @IsNotEmpty({ message: 'effective_date is required' })
  effective_date: string;
}
