import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsISO31661Alpha2,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

export class CheckoutPreflightItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  business_inventory_id!: string;

  @ApiProperty({ minimum: 1 })
  @IsNumber()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  item_variant_id?: string;
}

export class CheckoutPreflightDto {
  @ApiProperty({ type: [CheckoutPreflightItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutPreflightItemDto)
  items!: CheckoutPreflightItemDto[];

  @ApiPropertyOptional({
    description:
      'Delivery address UUID (authenticated). When absent, provisional_country must be supplied for guest pre-auth validation.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  delivery_address_id?: string;

  @ApiPropertyOptional({
    description:
      'Guest shopping country (ISO 3166-1 alpha-2). Used for pre-auth country validation and verification method selection. Required when delivery_address_id is absent.',
  })
  @IsOptional()
  @IsISO31661Alpha2()
  provisional_country?: string;

  @ApiPropertyOptional({
    enum: ['delivery', 'pickup'],
    default: 'delivery',
  })
  @IsOptional()
  @IsIn(['delivery', 'pickup'])
  fulfillment_method?: 'delivery' | 'pickup';

  @ApiPropertyOptional({
    enum: ['pay_now', 'pay_at_delivery', 'pay_at_pickup'],
    default: 'pay_now',
  })
  @IsOptional()
  @IsIn(['pay_now', 'pay_at_delivery', 'pay_at_pickup'])
  payment_timing?: 'pay_now' | 'pay_at_delivery' | 'pay_at_pickup';

  @ApiPropertyOptional({
    description:
      'E.164 phone number. Supplied to validate Mobile Money provider availability and phone-country alignment before checkout.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  phone_number?: string;

  @ApiPropertyOptional({ description: 'Discount code to pre-validate.' })
  @IsOptional()
  @IsString()
  discount_code?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requires_fast_delivery?: boolean;
}

// ---------------------------------------------------------------------------
// Response
// ---------------------------------------------------------------------------

export enum CheckoutMethod {
  STRIPE = 'STRIPE',
  MOBILE_MONEY = 'MOBILE_MONEY',
}

export enum VerificationMethod {
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
}

export class CheckoutBlockerDto {
  @ApiProperty({
    description: 'Machine-readable stable error code.',
    example: 'MIXED_COUNTRY_CART',
  })
  code!: string;

  @ApiProperty({ description: 'Human-readable message (English default).' })
  message!: string;
}

export class CheckoutItemLineDto {
  @ApiProperty()
  business_inventory_id!: string;

  @ApiProperty()
  quantity!: number;

  @ApiPropertyOptional()
  item_variant_id?: string;

  @ApiProperty()
  unit_price!: number;

  @ApiProperty()
  line_total!: number;

  @ApiPropertyOptional()
  item_name?: string;

  @ApiProperty({ description: 'ISO 3166-1 alpha-2 country of the seller.' })
  seller_country!: string;
}

export class CheckoutGroupDto {
  @ApiProperty()
  business_id!: string;

  @ApiPropertyOptional()
  business_name?: string;

  @ApiProperty({ description: 'ISO 4217 currency for this seller group.' })
  currency!: string;

  @ApiProperty({
    enum: ['stripe', 'mobile_money'],
    description:
      'Payment rail resolved from the business owner country. This is the authoritative rail used when POST /orders is called.',
  })
  payment_rail!: 'stripe' | 'mobile_money';

  @ApiProperty({
    type: [String],
    enum: ['pay_now', 'pay_at_delivery', 'pay_at_pickup'],
    description:
      'Payment timings allowed for this group based on item flags and seller rail.',
  })
  allowed_payment_timings!: Array<'pay_now' | 'pay_at_delivery' | 'pay_at_pickup'>;

  @ApiProperty({ description: 'Stripe-rail sellers do not require a payment phone.' })
  requires_payment_phone!: boolean;

  @ApiProperty({
    description: 'ISO 3166-1 alpha-2 country code of the seller primary location.',
  })
  seller_country!: string;

  @ApiProperty()
  subtotal!: number;

  @ApiPropertyOptional({ description: 'Delivery fee. Null when address not provided.' })
  delivery_fee?: number | null;

  @ApiPropertyOptional()
  is_first_order_client?: boolean;

  @ApiProperty()
  total!: number;

  @ApiPropertyOptional({
    description:
      'Mobile Money provider selected for the supplied phone number. Null when rail is Stripe or phone not supplied.',
    example: 'freemopay',
  })
  mobile_money_provider?: string | null;

  @ApiProperty({ type: [CheckoutItemLineDto] })
  items!: CheckoutItemLineDto[];
}

export class CheckoutDiscountPreviewDto {
  @ApiProperty()
  valid!: boolean;

  @ApiPropertyOptional({ description: 'Discount percentage (0-100).' })
  percentage?: number;

  @ApiPropertyOptional({ description: 'Discount amount off total.' })
  discount_amount?: number;

  @ApiPropertyOptional()
  message?: string;
}

export class CheckoutPreflightResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ description: 'False when any blocking_errors are present.' })
  can_proceed!: boolean;

  @ApiProperty({ type: [CheckoutBlockerDto] })
  blocking_errors!: CheckoutBlockerDto[];

  @ApiProperty({
    enum: CheckoutMethod,
    description:
      'Authoritative checkout method derived from seller/order rail. STRIPE requires email verification for guests; MOBILE_MONEY requires phone.',
  })
  checkout_method!: CheckoutMethod;

  @ApiProperty({
    enum: VerificationMethod,
    description:
      'Recommended identity verification method for guest checkout. Driven by checkout_method; never user-selectable.',
  })
  verification_method!: VerificationMethod;

  @ApiPropertyOptional({
    description:
      'Item countries found in the cart. Used for early country mismatch display.',
    type: [String],
  })
  item_countries?: string[];

  @ApiPropertyOptional({
    description:
      'Delivery country from the resolved address or provisional_country.',
  })
  delivery_country?: string | null;

  @ApiProperty({ type: [CheckoutGroupDto] })
  groups!: CheckoutGroupDto[];

  @ApiPropertyOptional({ type: CheckoutDiscountPreviewDto })
  discount?: CheckoutDiscountPreviewDto | null;

  @ApiPropertyOptional({
    description:
      'Buyer/user payment rail (informational only, from /stripe-connect/status logic). Does NOT drive checkout; seller rail in each group is authoritative.',
    enum: ['stripe', 'mobile_money'],
  })
  buyer_rail?: 'stripe' | 'mobile_money' | null;

  @ApiPropertyOptional({
    description:
      'True when buyer wallet balance covers the estimated total. Only set for authenticated requests.',
  })
  can_pay_with_wallet?: boolean | null;

  @ApiPropertyOptional({
    description:
      'Available wallet balance for the order currency. Only set for authenticated requests.',
  })
  wallet_balance?: number | null;

  @ApiProperty({
    description:
      'Whether a delivery address is required before the payment method can be confirmed. Always true for delivery orders.',
  })
  requires_address_for_payment!: boolean;

  @ApiProperty({
    description:
      'True when at least one seller group requires a Mobile Money phone number.',
  })
  requires_payment_phone!: boolean;

  @ApiPropertyOptional({
    description:
      'True when Stripe retry is not yet supported for orders that fail payment. Consumers should surface this to guide the user to pay from order details.',
  })
  stripe_retry_unsupported?: boolean;

  @ApiPropertyOptional({
    description:
      'True when Stripe manual capture is enabled (card authorized at checkout, charged after agent assignment).',
  })
  stripe_manual_capture?: boolean;

  @ApiPropertyOptional({
    description:
      'When set, sales tax is calculated at Stripe checkout and is not included in group totals.',
    enum: ['calculated_at_checkout'],
  })
  tax_notice?: 'calculated_at_checkout' | null;
}
