import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type ReorderSkipReason =
  | 'unavailable'
  | 'out_of_stock'
  | 'variant_unavailable'
  | 'not_orderable';

export type ReorderNavigationHint = 'checkout' | 'cart' | 'none';

export type ReorderFulfillmentType = 'delivery' | 'pickup' | 'shipping';

export class ReorderItemDataDto {
  @ApiProperty()
  name!: string;

  @ApiProperty()
  price!: number;

  @ApiProperty()
  currency!: string;

  @ApiPropertyOptional()
  image_url?: string | null;

  @ApiPropertyOptional()
  max_order_quantity?: number | null;

  @ApiPropertyOptional()
  min_order_quantity?: number | null;

  @ApiPropertyOptional()
  pay_on_delivery_enabled?: boolean | null;

  @ApiPropertyOptional()
  business_name?: string | null;

  @ApiPropertyOptional()
  seller_country?: string | null;

  @ApiPropertyOptional()
  merchant_can_accept_orders?: boolean | null;
}

export class ReorderLineDto {
  @ApiProperty({ format: 'uuid' })
  business_inventory_id!: string;

  @ApiProperty({ format: 'uuid' })
  item_id!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  item_variant_id?: string | null;

  @ApiProperty({ description: 'Quantity capped to current stock / max order qty' })
  quantity!: number;

  @ApiProperty({ description: 'Original ordered quantity from the prior order' })
  ordered_quantity!: number;

  @ApiPropertyOptional()
  variant_name?: string | null;

  @ApiProperty({ type: ReorderItemDataDto })
  item_data!: ReorderItemDataDto;

  @ApiProperty({ format: 'uuid' })
  business_location_id!: string;
}

export class ReorderSkippedDto {
  @ApiProperty()
  name!: string;

  @ApiProperty({
    enum: [
      'unavailable',
      'out_of_stock',
      'variant_unavailable',
      'not_orderable',
    ],
  })
  reason!: ReorderSkipReason;
}

export class ReorderFulfillmentDto {
  @ApiProperty({ enum: ['delivery', 'pickup', 'shipping'] })
  type!: ReorderFulfillmentType;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  address_id?: string | null;

  @ApiProperty()
  address_valid!: boolean;

  @ApiProperty()
  business_accepting_orders!: boolean;
}

export class ReorderOrderResponseDto {
  @ApiProperty({ format: 'uuid' })
  business_id!: string;

  @ApiProperty({ type: [ReorderLineDto] })
  lines!: ReorderLineDto[];

  @ApiProperty({ type: [ReorderSkippedDto] })
  skipped!: ReorderSkippedDto[];

  @ApiProperty({ type: ReorderFulfillmentDto })
  fulfillment!: ReorderFulfillmentDto;

  @ApiProperty({ enum: ['checkout', 'cart', 'none'] })
  navigation_hint!: ReorderNavigationHint;
}
