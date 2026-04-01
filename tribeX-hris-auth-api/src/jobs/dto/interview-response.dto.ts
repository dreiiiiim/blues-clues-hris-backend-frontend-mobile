import { IsIn, IsOptional, IsString } from 'class-validator';

export class InterviewResponseDto {
  @IsString() @IsIn(['accepted', 'declined', 'reschedule_requested'])
  action: 'accepted' | 'declined' | 'reschedule_requested';

  @IsString() @IsOptional()
  note?: string;
}
