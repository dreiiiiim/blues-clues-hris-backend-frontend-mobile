import { IsNotEmpty, IsUUID } from 'class-validator';

export class PaymentConfirmDto {
  @IsUUID()
  @IsNotEmpty()
  registration_id: string;
}
