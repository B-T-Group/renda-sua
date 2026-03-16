import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateItemFromImageDto {
  @ApiProperty({
    description: 'Business image id to create the item from',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  imageId!: string;

  @ApiProperty({
    description: 'Item name',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: 'Category name (created if not existing)',
    required: false,
  })
  @IsString()
  @IsOptional()
  categoryName?: string;

  @ApiProperty({
    description: 'Subcategory name (created if not existing)',
    required: false,
  })
  @IsString()
  @IsOptional()
  subCategoryName?: string;

  @ApiProperty({
    description: 'Brand name (created if not existing)',
    required: false,
  })
  @IsString()
  @IsOptional()
  brandName?: string;

  @ApiProperty({
    description: 'Item description (if empty, AI can generate later)',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Item price extracted from image (numeric value only)',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  price?: number;

  @ApiProperty({
    description:
      'Currency code for the price (defaults to XAF when not provided and price is present)',
    required: false,
  })
  @IsString()
  @IsOptional()
  currency?: string;
}

