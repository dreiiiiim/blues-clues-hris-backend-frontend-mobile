import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BulkSetSalaryBaselineDto {
  @ApiProperty({
    description: 'Basic salary amount for all employees',
    example: 25000,
  })
  @IsNumber()
  @Min(0)
  basic_salary: number;

  @ApiProperty({
    description: 'Pay frequency (monthly, semi-monthly, weekly, daily)',
    example: 'monthly',
  })
  @IsString()
  pay_frequency: 'monthly' | 'semi-monthly' | 'weekly' | 'daily';

  @ApiProperty({
    description: 'Effective date for salary baseline (ISO format)',
    example: '2026-01-01',
  })
  @IsString()
  effective_date: string;

  @ApiProperty({
    description: 'Optional: Only set salary for specific employee IDs',
    example: ['emp-001', 'emp-002'],
    required: false,
  })
  @IsOptional()
  employee_ids?: string[];

  @ApiProperty({
    description: 'Optional: Only set salary for employees missing one',
    example: true,
    required: false,
  })
  @IsOptional()
  only_missing?: boolean;
}
