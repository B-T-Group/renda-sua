/** POST /orders body (aligned with `CreateOrderRequest` in Nest `hasura-user.service`). */

export interface CreateOrderLineItem {
  business_inventory_id: string;
  quantity: number;
  item_variant_id?: string;
}

/**
 * Recipient contact details for diaspora orders (when someone else is receiving).
 */
export interface RecipientContact {
  /** Full name of the recipient. */
  name: string;
  /** E.164 phone number of the recipient. */
  phone: string;
  /** True to send WhatsApp updates to the recipient. */
  notify_whatsapp?: boolean;
}

export interface CreateOrderPayload {
  items: CreateOrderLineItem[];
  special_instructions?: string;
  fulfillment_method?: 'delivery' | 'pickup' | 'shipping';
  delivery_address_id?: string;
  phone_number?: string;
  requires_fast_delivery?: boolean;
  payment_timing?: 'pay_now' | 'pay_at_delivery' | 'pay_at_pickup';
  discount_code?: string;
  /** Request a PaymentIntent client secret for the native PaymentSheet. */
  stripe_payment_method?: 'payment_sheet';
  delivery_window?: {
    slot_id: string;
    preferred_date: string;
    special_instructions?: string;
  };
  /** Recipient contact details for diaspora orders (when someone else is receiving). */
  recipient?: RecipientContact;
}

export interface CreatedOrder {
  id: string;
  order_number?: string;
  payment_rail?: 'stripe' | 'mobile_money';
  /** Present on Stripe-rail orders created with `stripe_payment_method: 'payment_sheet'`. */
  payment_intent_client_secret?: string | null;
  payment_reference?: string;
  payment_transaction?: {
    success?: boolean;
    transaction_id?: string | null;
    message?: string;
    mode?: string;
  };
  /** Database transaction ID (for MoMo deposit collect). */
  database_transaction?: {
    id?: string;
  };
  payment_status?: string;
  current_status?: string;
  /** Deposit amount charged (XAF). Present on MoMo deposit orders. #275 @ c00abe02. */
  deposit_amount?: number | null;
  /** Remaining amount due after deposit (= total − deposit). #275 @ c00abe02. */
  amount_due?: number | null;
  /** Deposit payment status (backend enum: none|pending|paid|failed|forfeited|refunded; pending_payment is current_status). #275 @ c00abe02. */
  deposit_status?: 'none' | 'pending' | 'paid' | 'failed' | 'forfeited' | 'refunded' | null;
  /** Database transaction ID for MoMo deposit collect (FK to mobile_payment_transactions). #275 @ c00abe02. */
  deposit_mobile_payment_transaction_id?: string | null;
}

export interface CreateOrderResponse {
  success: boolean;
  order?: CreatedOrder;
  message?: string;
  error?: string;
  data?: {
    orderNumber?: string;
    error?: string;
    message?: string;
    errorCode?: string;
  };
}
