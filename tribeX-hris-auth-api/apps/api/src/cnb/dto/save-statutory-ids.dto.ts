import {
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class SaveStatutoryIdsDto {
  @IsOptional()
  @IsString({ message: 'tin_number must be a string' })
  @Matches(/^\d{3}-\d{3}-\d{3}-\d{3}$/, {
    message: 'tin_number must be in the format 123-456-789-000',
  })
  tin_number?: string;

  @IsOptional()
  @IsString({ message: 'sss_number must be a string' })
  @Matches(/^\d{2}-\d{7}-\d{1}$/, {
    message: 'sss_number must be in the format 12-3456789-0',
  })
  sss_number?: string;

  @IsOptional()
  @IsString({ message: 'philhealth_number must be a string' })
  @Matches(/^\d{2}-\d{9}-\d{1}$/, {
    message: 'philhealth_number must be in the format 12-345678901-2',
  })
  philhealth_number?: string;

  @IsOptional()
  @IsString({ message: 'pagibig_number must be a string' })
  @Matches(/^\d{4}-\d{4}-\d{4}$/, {
    message: 'pagibig_number must be in the format 1234-5678-9012',
  })
  pagibig_number?: string;
}
