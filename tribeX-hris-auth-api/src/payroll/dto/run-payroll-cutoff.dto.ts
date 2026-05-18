import { IsString, IsDateString, IsNotEmpty } from 'class-validator';

export class RunPayrollCutoffDto {
  @IsString({ message: 'cutoff_date must be a string' })
  @IsDateString({}, { message: 'cutoff_date must be a valid ISO 8601 date (YYYY-MM-DD)' })
  @IsNotEmpty({ message: 'cutoff_date is required' })
  cutoff_date: string; // YYYY-MM-DD — must match an existing cnb_payroll_periods payout_date
}
