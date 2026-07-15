import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ShopifyInstallDto {
  @ApiProperty({ example: 'my-store.myshopify.com' })
  @IsString()
  shopDomain!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  businessId?: string;
}

export class LocationMappingItemDto {
  @ApiProperty()
  @IsString()
  externalId!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  internalId?: string | null;

  @ApiProperty()
  @IsBoolean()
  syncEnabled!: boolean;
}

export class SaveLocationMappingsDto {
  @ApiProperty({ type: [LocationMappingItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LocationMappingItemDto)
  mappings!: LocationMappingItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  businessId?: string;
}

export class ImportProductsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  externalProductIds!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  businessId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  defaultSubCategoryId?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  importInventory?: boolean;
}
