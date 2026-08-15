import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateItemDto {
  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ default: '' })
  description?: string;

  @ApiProperty()
  item_sub_category_id!: number;

  @ApiPropertyOptional({
    description:
      'Catalog price. Optional for drafts; required before publishing.',
  })
  price?: number;

  @ApiProperty({ default: 'XAF' })
  currency!: string;

  @ApiPropertyOptional()
  sku?: string | null;

  @ApiPropertyOptional()
  brand_id?: string | null;

  @ApiPropertyOptional()
  weight?: number | null;

  @ApiPropertyOptional()
  weight_unit?: string | null;

  @ApiPropertyOptional()
  dimensions?: string | null;

  @ApiPropertyOptional()
  model?: string | null;

  @ApiPropertyOptional()
  color?: string | null;

  @ApiPropertyOptional()
  is_fragile?: boolean;

  @ApiPropertyOptional()
  is_perishable?: boolean;

  @ApiPropertyOptional({
    description: 'True when the item is used / pre-owned (not new).',
  })
  is_used?: boolean;

  @ApiPropertyOptional()
  requires_special_handling?: boolean;

  @ApiPropertyOptional()
  max_delivery_distance?: number | null;

  @ApiPropertyOptional()
  estimated_delivery_time?: number | null;

  @ApiPropertyOptional()
  min_order_quantity?: number;

  @ApiPropertyOptional()
  max_order_quantity?: number | null;

  @ApiPropertyOptional()
  is_active?: boolean;

  @ApiPropertyOptional()
  pay_on_delivery_enabled?: boolean;

  @ApiPropertyOptional({
    description: 'When true, this item can be shipped via carrier. Default false.',
    default: false,
  })
  shipping_enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Cost to ship this item via carrier. Required when shipping_enabled is true.',
  })
  shipping_price?: number | null;

  @ApiPropertyOptional({
    description: 'Currency for shipping_price. Defaults to XAF.',
    default: 'XAF',
  })
  shipping_currency?: string;

  @ApiPropertyOptional({ default: 'txcd_99999999' })
  stripe_tax_code_id?: string;
}
