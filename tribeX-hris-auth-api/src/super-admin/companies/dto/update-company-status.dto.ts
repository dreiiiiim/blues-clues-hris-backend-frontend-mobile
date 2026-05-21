import { IsIn } from 'class-validator';

export class UpdateCompanyStatusDto {
  @IsIn(['Active', 'Suspended', 'Expired', 'Pending'])
  subscription_status: string;
}
