import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsOptional,
  IsIn,
  ArrayNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ChecklistTemplateItemDto {
  @ApiProperty() @IsString() @IsNotEmpty() item_name: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() description?: string;
  @ApiProperty() @IsBoolean() is_required: boolean;
  // GAP-7.1 FIX: category routes item into correct Employee dashboard tab
  @ApiProperty({ required: false, enum: ['Asset', 'Document', 'Task'] })
  @IsString() @IsIn(['Asset', 'Document', 'Task']) @IsOptional()
  category?: 'Asset' | 'Document' | 'Task';
  // GAP-7.1 FIX: is_custom distinguishes tenant-added vs base template items
  @ApiProperty({ required: false, default: false })
  @IsBoolean() @IsOptional()
  is_custom?: boolean;
}

export class ConfigureChecklistTemplateDto {
  @ApiProperty() @IsString() @IsNotEmpty() template_name: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() employee_type?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() description?: string;
  @ApiProperty({ required: false, type: [String], enum: ['Resignation', 'Termination', 'End of Contract'] })
  @IsArray() @IsString({ each: true }) @IsIn(['Resignation', 'Termination', 'End of Contract'], { each: true }) @IsOptional()
  applicable_offboarding_types?: Array<'Resignation' | 'Termination' | 'End of Contract'>;
  @ApiProperty({ required: false, default: false })
  @IsBoolean() @IsOptional()
  is_default?: boolean;
  @ApiProperty({ required: false, default: true })
  @IsBoolean() @IsOptional()
  require_knowledge_transfer?: boolean;
  @ApiProperty({ required: false, type: [String] })
  @IsArray() @IsString({ each: true }) @IsOptional()
  system_access_to_revoke?: string[];
  @ApiProperty({ type: [ChecklistTemplateItemDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => ChecklistTemplateItemDto)
  items: ChecklistTemplateItemDto[];
}
