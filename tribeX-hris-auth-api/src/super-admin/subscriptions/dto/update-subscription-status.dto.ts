import { IsIn } from 'class-validator';

export class UpdateSubscriptionStatusDto {
  @IsIn(['Active', 'Suspended', 'Expired', 'Pending'])
  subscription_status: string;
}
