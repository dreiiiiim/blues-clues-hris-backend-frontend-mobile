// Ito yung structure ng data na tatanggapin ng login endpoint.

//EMAIL ONLY FOR NOW, CAN BE CHANGED LATER IF NEEDED
// export class LoginDto {
//   @IsEmail()
//   email: string;

//   @IsString()
//   @MinLength(6)
//   password: string;
// }

// login.dto.ts

import { IsNotEmpty, IsString, MinLength, IsBoolean, Matches, IsOptional } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9._@-]+$/, { message: 'Invalid identifier format' })
  identifier: string; // email OR username OR employee_id

  @IsString()
  @MinLength(6)
  password: string;

  @IsBoolean()
  rememberMe?: boolean; // true = long refresh token lifetime

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'Invalid slug format' })
  slug?: string; // present when logging in via a company subdomain
}
