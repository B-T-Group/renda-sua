import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsUUID,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VariantPriceOverrideEntryDto {
  @ApiProperty({ description: 'Item variant UUID' })
  @IsUUID()
  item_variant_id!: string;

  @ApiPropertyOptional({
    description:
      'Location-specific selling price, or null to clear the override',
    nullable: true,
  })
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsNumber()
  @Min(0)
  selling_price!: number | null;
}

export class BulkVariantPriceOverridesDto {
  @ApiProperty({ type: [VariantPriceOverrideEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantPriceOverrideEntryDto)
  overrides!: VariantPriceOverrideEntryDto[];
}
