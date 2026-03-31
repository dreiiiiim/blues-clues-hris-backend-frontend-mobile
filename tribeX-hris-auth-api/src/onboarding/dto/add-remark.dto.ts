import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID, IsEnum } from 'class-validator';

export enum TabTagEnum {
  DOCUMENTS = 'Documents',
  TASKS = 'Tasks',
  EQUIPMENT = 'Equipment',
  PROFILE = 'Profile',
  FORMS = 'Forms',
}

export class AddRemarkDto {
  @ApiProperty() @IsUUID()
  session_id: string;

  @ApiProperty({ enum: TabTagEnum })
  @IsEnum(TabTagEnum)
  tab_tag: TabTagEnum;

  @ApiProperty() @IsString() @IsNotEmpty()
  remark_text: string;
}
