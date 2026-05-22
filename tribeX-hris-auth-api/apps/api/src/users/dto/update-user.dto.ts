import { IsString, IsOptional, IsNotEmpty, IsArray, ArrayMinSize } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  first_name?: string;

  @IsOptional()
  @IsString()
  middle_name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  last_name?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one role must be selected' })
  @IsString({ each: true })
  role_ids?: string[];

  @IsOptional()
  @IsString()
  department_id?: string;

  @IsOptional()
  @IsString()
  start_date?: string;

  // Extended profile fields — writable by System Admin; viewable by HR
  @IsOptional()
  @IsString()
  account_status?: string;

  @IsOptional()
  @IsString()
  personal_email?: string;

  @IsOptional()
  @IsString()
  date_of_birth?: string;

  @IsOptional()
  @IsString()
  place_of_birth?: string;

  @IsOptional()
  @IsString()
  nationality?: string;

  @IsOptional()
  @IsString()
  civil_status?: string;

  @IsOptional()
  @IsString()
  complete_address?: string;

  @IsOptional()
  @IsString()
  bank_name?: string;

  @IsOptional()
  @IsString()
  bank_account_number?: string;

  @IsOptional()
  @IsString()
  bank_account_name?: string;
}
