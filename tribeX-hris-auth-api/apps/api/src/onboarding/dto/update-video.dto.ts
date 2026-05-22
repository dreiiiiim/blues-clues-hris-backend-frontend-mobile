import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, IsBoolean, Min } from 'class-validator';

export class UpdateVideoDto {
  @ApiProperty({ required: false })
  @IsString() @IsOptional()
  title?: string;

  @ApiProperty({ required: false })
  @IsString() @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsString() @IsOptional()
  video_url?: string;

  @ApiProperty({ required: false })
  @IsInt() @Min(1) @IsOptional()
  sequence_order?: number;

  @ApiProperty({ required: false })
  @IsBoolean() @IsOptional()
  is_active?: boolean;
}
