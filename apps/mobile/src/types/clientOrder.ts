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
  payment_status?: string;
  current_status?: string;
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
