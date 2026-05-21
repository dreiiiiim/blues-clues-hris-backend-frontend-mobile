import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateCheckoutDto {
  @IsUUID()
  @IsNotEmpty()
  registration_id: string;
}
