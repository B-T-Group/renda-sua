import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * One row from CSV upload. Matches frontend CSVItemWithInventory.
 * business_id is ignored; backend uses authenticated user's business.
 */
export class CsvItemRowDto {
  @ApiProperty({ example: 'Product Name' })
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 29.99 })
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiProperty({ example: 'USD' })
  @IsString()
  currency!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  sku?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  weight?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  weight_unit?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  dimensions?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  model?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  is_fragile?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  is_perishable?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  requires_special_handling?: boolean;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Min(0)
  min_order_quantity?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Min(0)
  max_order_quantity?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @ApiPropertyOptional({ example: 1 })
  @IsNumber()
  @IsOptional()
  item_sub_category_id?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  brand_id?: string;

  @ApiProperty({ example: 'Main Warehouse', description: 'Location name to resolve to business_location_id' })
  @IsString()
  business_location_name!: string;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(0)
  quantity!: number;

  @ApiProperty({ example: 0 })
  @IsNumber()
  @Min(0)
  reserved_quantity!: number;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(0)
  reorder_point!: number;

  @ApiProperty({ example: 50 })
  @IsNumber()
  @Min(0)
  reorder_quantity!: number;

  @ApiProperty({ example: 20 })
  @IsNumber()
  @Min(0)
  unit_cost!: number;

  @ApiProperty({ example: 29.99 })
  @IsNumber()
  @Min(0)
  selling_price!: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  image_url?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  image_alt_text?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  image_caption?: string;
}

export class CsvUploadRequestDto {
  @ApiProperty({ type: [CsvItemRowDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CsvItemRowDto)
  rows!: CsvItemRowDto[];
}

export interface CsvUploadResultDto {
  /** Number of rows that completed without error */
  success: number;
  inserted: number;
  updated: number;
  errors: number;
  details: {
    inserted: string[];
    updated: string[];
    errors: Array<{ row: number; error: string }>;
  };
}
