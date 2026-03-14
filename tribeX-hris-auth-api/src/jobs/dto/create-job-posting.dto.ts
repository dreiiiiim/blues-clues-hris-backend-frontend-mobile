import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateJobPostingDto {
  @ApiProperty({ example: 'Senior Software Engineer' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty({ example: 'We are looking for a senior engineer...' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ example: 'Manila, Philippines' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @ApiPropertyOptional({ example: 'Full-time', enum: ['Full-time', 'Part-time', 'Contract', 'Internship'] })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  employment_type?: string;

  @ApiPropertyOptional({ example: '₱50,000 - ₱80,000' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  salary_range?: string;

  @ApiPropertyOptional({ example: 'DEPT-001' })
  @IsOptional()
  @IsString()
  department_id?: string;

  @ApiPropertyOptional({ example: '2026-06-30T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  closes_at?: string;
}
