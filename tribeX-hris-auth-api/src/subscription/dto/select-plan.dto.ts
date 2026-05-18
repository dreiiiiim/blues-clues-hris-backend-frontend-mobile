import { IsIn, IsNotEmpty, IsUUID } from 'class-validator';

export class SelectPlanDto {
  @IsUUID()
  @IsNotEmpty()
  registration_id: string;

  @IsIn(['monthly', 'annual'])
  subscription_plan: string;

  @IsIn(['monthly', 'annual'])
  billing_cycle: string;
}
