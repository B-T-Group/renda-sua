import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { RENTAL_OPERATION_MODES } from '../../rentals/dto/create-business-rental-item.dto';

export type CreateRentalFromImageMode = 'manual' | 'ai';

export class CreateRentalFromImageDto {
  @ApiProperty({
    enum: ['manual', 'ai'],
    default: 'manual',
    description:
      'manual: use name and rental_category_id from the body. ai: infer fields from the image (optional body fields override).',
  })
  @IsIn(['manual', 'ai'])
  @IsOptional()
  mode?: CreateRentalFromImageMode;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  imageId!: string;

  @ApiProperty({
    required: false,
    description: 'Required when mode is manual (default).',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    format: 'uuid',
    required: false,
    description: 'Required when mode is manual. Optional override when mode is ai.',
  })
  @IsOptional()
  @IsUUID()
  rental_category_id?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false, default: 'XAF' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({ required: false, default: false })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

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
