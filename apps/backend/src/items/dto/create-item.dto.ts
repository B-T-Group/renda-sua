import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateItemDto {
  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ default: '' })
  description?: string;

  @ApiProperty()
  item_sub_category_id!: number;

  @ApiProperty()
  price!: number;

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

  @ApiPropertyOptional({ default: 'txcd_99999999' })
  stripe_tax_code_id?: string;
}
