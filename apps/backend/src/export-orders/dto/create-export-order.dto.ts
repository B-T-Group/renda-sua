import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateExportOrderDto {
  @ApiProperty({ description: 'business_inventory.id for the export listing' })
  @IsUUID()
  businessInventoryId!: string;

  @ApiPropertyOptional({ description: 'Quantity requested', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity?: number;

  @ApiPropertyOptional({ description: 'Product characteristics / specs' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  characteristics?: string;

  @ApiPropertyOptional({ description: 'Particularities / special requests' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  particularities?: string;

  @ApiPropertyOptional({ description: 'Optional note from the client' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @ApiPropertyOptional({ description: 'Destination country ISO code' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  countryCode?: string;
}
