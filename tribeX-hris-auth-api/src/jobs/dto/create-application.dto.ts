import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

export class ApplicationAnswerDto {
  @IsUUID()
  question_id: string;

  @IsOptional()
  @IsString()
  answer_value?: string;
}

export class CreateApplicationDto {
  @ApiPropertyOptional({ type: [ApplicationAnswerDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApplicationAnswerDto)
  answers?: ApplicationAnswerDto[];
}
