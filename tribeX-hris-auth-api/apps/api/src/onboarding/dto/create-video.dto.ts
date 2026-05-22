import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsInt, IsBoolean, IsUUID, Min } from 'class-validator';

export class CreateVideoDto {
  @ApiProperty({ description: 'Onboarding template this video belongs to (= job position)' })
  @IsUUID()
  template_id: string;

  @ApiProperty({ example: 'Company Safety Orientation' })
  @IsString() @IsNotEmpty()
  title: string;

  @ApiProperty({ required: false, example: 'Overview of workplace safety protocols.' })
  @IsString() @IsOptional()
  description?: string;

  @ApiProperty({ example: 'https://example.com/videos/safety-orientation.mp4' })
  @IsString() @IsNotEmpty()
  video_url: string;

  @ApiProperty({ example: 1, description: 'Ascending order; lower value plays first' })
  @IsInt() @Min(1)
  sequence_order: number;

  @ApiProperty({ required: false, example: true })
  @IsBoolean() @IsOptional()
  is_active?: boolean;
}
