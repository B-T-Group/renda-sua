import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { RENTAL_OPERATION_MODES } from './create-business-rental-item.dto';

export class UpdateBusinessRentalItemDto {
  @ApiProperty({ required: false, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  rental_category_id?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({
    required: false,
    enum: RENTAL_OPERATION_MODES,
    description:
      'business_operated: staff-run at location; take_home: client picks up and returns',
  })
  @IsOptional()
  @IsIn(RENTAL_OPERATION_MODES)
  operation_mode?: (typeof RENTAL_OPERATION_MODES)[number];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
