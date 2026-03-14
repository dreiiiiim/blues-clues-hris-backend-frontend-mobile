import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class ApplicationQuestionDto {
  @ApiProperty({ example: 'Why do you want this job?' })
  @IsString()
  @IsNotEmpty()
  question_text: string;

  @ApiProperty({ enum: ['text', 'multiple_choice', 'checkbox'] })
  @IsIn(['text', 'multiple_choice', 'checkbox'])
  question_type: 'text' | 'multiple_choice' | 'checkbox';

  @ApiPropertyOptional({ example: ['Option A', 'Option B'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @ApiProperty({ example: true })
  @IsBoolean()
  is_required: boolean;

  @ApiProperty({ example: 0 })
  @IsNumber()
  sort_order: number;
}

export class SetQuestionsDto {
  @ApiProperty({ type: [ApplicationQuestionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApplicationQuestionDto)
  questions: ApplicationQuestionDto[];
}
