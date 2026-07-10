import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export const RENTAL_OPERATION_MODES = [
  'business_operated',
  'take_home',
] as const;

export type RentalOperationMode = (typeof RENTAL_OPERATION_MODES)[number];

export class CreateBusinessRentalItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  rental_category_id!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ required: false, default: 'XAF' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({
    required: false,
    enum: RENTAL_OPERATION_MODES,
    default: 'business_operated',
    description:
      'business_operated: staff-run at location; take_home: client picks up and returns',
  })
  @IsOptional()
  @IsIn(RENTAL_OPERATION_MODES)
  operation_mode?: (typeof RENTAL_OPERATION_MODES)[number];
}
