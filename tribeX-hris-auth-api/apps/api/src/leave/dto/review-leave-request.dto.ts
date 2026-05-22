import {
  Transform,
  TransformFnParams,
} from 'class-transformer';
import {
  IsString,
  IsIn,
  IsOptional,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';

export class ReviewLeaveRequestDto {
  @IsString({ message: 'status must be a string' })
  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string'
      ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
      : value,
  )
  @IsIn(['Approved', 'Rejected'], {
    message: 'status must be either Approved or Rejected',
  })
  @IsNotEmpty({ message: 'status is required' })
  status: 'Approved' | 'Rejected';

  @IsOptional()
  @IsString({ message: 'rejection_reason must be a string' })
  @MaxLength(500, { message: 'rejection_reason must not exceed 500 characters' })
  rejection_reason?: string;
}
