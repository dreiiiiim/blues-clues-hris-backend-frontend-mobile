import { IsOptional, IsString } from 'class-validator';

export class SwitchRoleDto {
  @IsOptional()
  @IsString()
  role_id?: string;
}
