import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
} from 'class-validator';

export class PaymentConfirmDto {
  @IsUUID()
  @IsNotEmpty()
  registration_id: string;

  @IsString()
  @IsNotEmpty()
  transaction_id: string;

  @IsNumber()
  amount: number;

  @IsString()
  @IsNotEmpty()
  payment_method: string;

  @IsDateString()
  payment_date: string;
}
