import { IsNumber, IsIn, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TimePunchDto {
  @ApiProperty({
    description: 'GPS latitude coordinate (required — location must be granted)',
    example: 14.5995,
  })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({
    description: 'GPS longitude coordinate (required — location must be granted)',
    example: 120.9842,
  })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;
}