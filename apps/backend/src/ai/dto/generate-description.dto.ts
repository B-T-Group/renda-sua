import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class GenerateDescriptionDto {
  @ApiProperty({
    description: 'Product name',
    example: 'Wireless Bluetooth Headphones',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: 'Product SKU',
    example: 'WBH-001',
    required: false,
  })
  @IsString()
  @IsOptional()
  sku?: string;

  @ApiProperty({
    description: 'Product category',
    example: 'Electronics',
    required: false,
  })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({
    description: 'Product subcategory',
    example: 'Audio & Headphones',
    required: false,
  })
  @IsString()
  @IsOptional()
  subCategory?: string;

  @ApiProperty({
    description: 'Product price',
    example: 99.99,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  price?: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'XAF',
    required: false,
  })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({
    description: 'Product weight',
    example: 250,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  weight?: number;

  @ApiProperty({
    description: 'Weight unit',
    example: 'g',
    required: false,
  })
  @IsString()
  @IsOptional()
  weightUnit?: string;

  @ApiProperty({
    description: 'Product brand',
    example: 'TechSound',
    required: false,
  })
  @IsString()
  @IsOptional()
  brand?: string;

  @ApiProperty({
    description: 'Language for the description',
    example: 'en',
    enum: ['en', 'fr'],
    default: 'en',
  })
  @IsString()
  @IsIn(['en', 'fr'])
  @IsOptional()
  language?: 'en' | 'fr' = 'en';
}
