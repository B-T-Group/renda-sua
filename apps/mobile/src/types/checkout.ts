/**
 * Checkout resolver types.
 *
 * These mirror the backend CheckoutPreflightResponseDto so the mobile app
 * never duplicates payment-rail business rules. All decisions come from
 * POST /orders/checkout/preflight. The UI simply renders what the resolver
 * returns.
 */

export type CheckoutMethod = 'STRIPE' | 'MOBILE_MONEY';
export type VerificationMethod = 'EMAIL' | 'PHONE';
export type PaymentRail = 'stripe' | 'mobile_money';
export type PaymentTiming = 'pay_now' | 'pay_at_delivery' | 'pay_at_pickup';
export type FulfillmentMethod = 'delivery' | 'pickup' | 'shipping';

/** Stable error codes returned by the preflight endpoint and enforced by POST /orders. */
export type CheckoutErrorCode =
  | 'INVENTORY_FETCH_FAILED'
  | 'INVENTORY_NOT_FOUND'
  | 'ITEM_NOT_FOUND'
  | 'ITEM_UNAVAILABLE'
  | 'INSUFFICIENT_STOCK'
  | 'MAX_ORDER_QUANTITY_EXCEEDED'
  | 'UNSUPPORTED_COUNTRY_COMBINATION'
  | 'MIXED_COUNTRY_CART'
  | 'MIXED_PAYMENT_RAILS'
  | 'DELIVERY_COUNTRY_MISMATCH'
  | 'MISSING_PAYMENT_CAPABILITY'
  | 'STRIPE_UNAVAILABLE'
  | 'MOBILE_MONEY_UNAVAILABLE'
  | 'MOBILE_MONEY_PHONE_UNSUPPORTED'
  | 'INVALID_ADDRESS'
  | 'CHECKOUT_COUNTRY_CHANGED'
  | 'CART_REVALIDATION_REQUIRED'
  | 'PAY_AT_DELIVERY_UNAVAILABLE'
  | 'PICKUP_UNAVAILABLE'
  | 'SHIPPING_UNAVAILABLE'
  | 'SHIPPING_REQUIRES_PAY_NOW'
  | 'PAY_AT_DELIVERY_STRIPE_NOT_SUPPORTED'
  | 'PHONE_NUMBER_REQUIRED'
  | 'DISCOUNT_CODE_INVALID'
  | 'DISCOUNT_CODE_SELF_USE_NOT_ALLOWED'
  | 'STRIPE_RETRY_UNSUPPORTED'
  | 'MERCHANT_NOT_ACCEPTING_ORDERS'
  | string; // forward-compatible

export interface CheckoutBlocker {
  code: CheckoutErrorCode;
  message: string;
}

export interface CheckoutItemLine {
  business_inventory_id: string;
  quantity: number;
  item_variant_id?: string;
  unit_price: number;
  line_total: number;
  item_name?: string;
  seller_country: string;
}

/**
 * Reason-blind delivery availability from the backend rules engine. When
 * `available` is false, show the generic "Delivery is currently unavailable."
 * copy and steer the user to store pickup — no internal reason is exposed.
 */
export interface CheckoutDeliveryAvailability {
  available: boolean;
  estimated_delivery_minutes: number | null;
}

export interface CheckoutGroup {
  business_id: string;
  business_name?: string;
  currency: string;
  /** Authoritative rail based on seller/business-owner country. */
  payment_rail: PaymentRail;
  allowed_payment_timings: PaymentTiming[];
  requires_payment_phone: boolean;
  seller_country: string;
  /** State/province of the seller primary location. Used to fetch pickup/delivery slots. */
  seller_state?: string;
  /** Business location id for this group, used to filter slots by operating hours. */
  business_location_id?: string;
  subtotal: number;
  delivery_fee?: number | null;
  is_first_order_client?: boolean;
  total: number;
  mobile_money_provider?: string | null;
  /** Null when the requested fulfillment is pickup. */
  delivery_availability?: CheckoutDeliveryAvailability | null;
  /** True when every item in this group supports store pickup checkout. */
  pickup_eligible?: boolean;
  /** True when every item in this group supports carrier shipping checkout. */
  shipping_eligible?: boolean;
  items: CheckoutItemLine[];
  asap_available?: boolean;
  asap_disabled_reason?: 'merchant_closed' | 'too_close_to_close' | 'merchant_paused';
  opens_at?: string | null;
  estimated_prep_minutes?: number;
  estimated_ready_at?: string;
  estimated_fulfill_by?: string;
  schedule_required?: boolean;
}

export interface CheckoutDiscountPreview {
  valid: boolean;
  percentage?: number;
  discount_amount?: number;
  message?: string;
}

/**
 * Diaspora checkout context returned from backend when order is cross-border
 * and/or intended for a recipient different from the payer.
 */
export interface CheckoutDiaspora {
  /** True when this is a diaspora order (cross-border or someone-else receiving). */
  is_diaspora: boolean;
  /** ISO country code of the payer (e.g. "CA", "US"). */
  payer_country?: string;
  /** ISO country code where order will be fulfilled (e.g. "GA", "CM"). */
  fulfillment_country?: string;
  /** Payment rail source identifier (e.g. "stripe"). */
  rail_source?: string;
  /** Optional indicative FX charge estimate from backend (display only). */
  payer_charge_estimate?: {
    amount: number;
    currency: string;
    exchange_rate?: number;
  } | null;
  /** True when recipient contact details are required for this order. */
  requires_recipient_contact?: boolean;
}

/**
 * Normalized checkout configuration returned from POST /orders/checkout/preflight.
 *
 * The UI must drive all rendering from this object.
 * Do NOT embed payment-rail logic in screens or hooks.
 */
export interface ResolvedCheckoutConfig {
  success: boolean;
  can_proceed: boolean;
  blocking_errors: CheckoutBlocker[];
  /** Authoritative checkout method for this order. Drives the full UI path. */
  checkout_method: CheckoutMethod;
  /**
   * Verification method for guest checkout. STRIPE ? email only. MOBILE_MONEY ? phone only.
   * Never let the user change this.
   */
  verification_method: VerificationMethod;
  item_countries?: string[];
  delivery_country?: string | null;
  groups: CheckoutGroup[];
  discount?: CheckoutDiscountPreview | null;
  /** Buyer rail (informational only; does NOT drive checkout). */
  buyer_rail?: PaymentRail | null;
  can_pay_with_wallet?: boolean | null;
  wallet_balance?: number | null;
  requires_address_for_payment: boolean;
  requires_payment_phone: boolean;
  /** True = no in-app Stripe retry; guide user to order detail screen. */
  stripe_retry_unsupported?: boolean;
  stripe_manual_capture?: boolean;
  tax_notice?: 'calculated_at_checkout' | null;
  /**
   * Aggregated delivery availability across all seller groups. Null when the
   * requested fulfillment is pickup.
   */
  delivery_availability?: CheckoutDeliveryAvailability | null;
  asap_available?: boolean;
  asap_disabled_reason?: 'merchant_closed' | 'too_close_to_close' | 'merchant_paused';
  opens_at?: string | null;
  estimated_prep_minutes?: number;
  estimated_ready_at?: string;
  estimated_fulfill_by?: string;
  schedule_required?: boolean;
  /** Diaspora checkout context (when cross-border or someone-else receiving). */
  diaspora?: CheckoutDiaspora | null;
}

/** Input shape for POST /orders/checkout/preflight */
export interface CheckoutPreflightRequest {
  items: Array<{
    business_inventory_id: string;
    quantity: number;
    item_variant_id?: string;
  }>;
  delivery_address_id?: string;
  provisional_country?: string;
  fulfillment_method?: FulfillmentMethod;
  payment_timing?: PaymentTiming;
  phone_number?: string;
  discount_code?: string;
  requires_fast_delivery?: boolean;
}

/** Quick summary for wizard phase computation. */
export interface CheckoutWizardPhase {
  phase: 'loading' | 'country_blocked' | 'address' | 'phone' | 'checkout' | 'error';
  blockingError?: CheckoutBlocker;
}
