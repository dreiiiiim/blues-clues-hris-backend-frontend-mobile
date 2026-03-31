import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsDateString, IsEmail } from 'class-validator';

export class SaveProfileDto {
  @ApiProperty() @IsString() @IsNotEmpty()
  first_name: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional()
  middle_name?: string;

  @ApiProperty() @IsString() @IsNotEmpty()
  last_name: string;

  @ApiProperty() @IsEmail()
  email_address: string;

  @ApiProperty() @IsString() @IsNotEmpty()
  phone_number: string;

  @ApiProperty() @IsString() @IsNotEmpty()
  complete_address: string;

  @ApiProperty() @IsDateString()
  date_of_birth: string;

  @ApiProperty() @IsString() @IsNotEmpty()
  place_of_birth: string;

  @ApiProperty() @IsString() @IsNotEmpty()
  nationality: string;

  @ApiProperty() @IsString() @IsNotEmpty()
  civil_status: string;

  @ApiProperty() @IsString() @IsNotEmpty()
  contact_name: string;

  @ApiProperty() @IsString() @IsNotEmpty()
  relationship: string;

  @ApiProperty() @IsString() @IsNotEmpty()
  emergency_phone_number: string;

  @ApiProperty({ required: false }) @IsEmail() @IsOptional()
  emergency_email_address?: string;
}
