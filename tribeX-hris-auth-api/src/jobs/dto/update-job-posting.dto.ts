import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateJobPostingDto {
  @ApiPropertyOptional({ example: 'Senior Software Engineer' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Manila, Philippines' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @ApiPropertyOptional({ enum: ['Full-time', 'Part-time', 'Contract', 'Internship'] })
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

  @ApiPropertyOptional({ enum: ['open', 'closed', 'draft'] })
  @IsOptional()
  @IsIn(['open', 'closed', 'draft'])
  status?: string;
}
