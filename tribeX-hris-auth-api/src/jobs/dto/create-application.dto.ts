import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateApplicationDto {
  @ApiPropertyOptional({ example: 'I am very interested in this position...' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  cover_letter?: string;
}
