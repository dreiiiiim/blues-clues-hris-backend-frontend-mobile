import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RegisterCompanyDto {
  @IsString()
  @IsNotEmpty()
  company_name: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  contact: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  industry: string;

  @IsString()
  @IsNotEmpty()
  nature_of_business: string;

  @IsString()
  @IsNotEmpty()
  tin: string;

  @IsOptional()
  @IsString()
  business_permit_url?: string;

  @IsOptional()
  @IsString()
  registration_cert_url?: string;

  @IsOptional()
  @IsString()
  hr_org_structure?: string;
}
