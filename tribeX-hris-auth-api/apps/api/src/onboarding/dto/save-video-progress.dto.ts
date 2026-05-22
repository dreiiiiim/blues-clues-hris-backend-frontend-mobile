import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsBoolean, IsOptional, Min } from 'class-validator';

export class SaveVideoProgressDto {
  @ApiProperty({ example: 142.5, description: 'Current playback position in seconds (bookmark)' })
  @IsNumber() @Min(0)
  watched_seconds: number;

  @ApiProperty({ example: 200.0, description: 'Furthest second ever reached (anti-skip boundary)' })
  @IsNumber() @Min(0)
  max_watched_seconds: number;

  @ApiProperty({ example: false, description: 'Set true only when playback reaches the end of the video' })
  @IsBoolean() @IsOptional()
  is_completed?: boolean;
}
