export type RefundDestination = 'stripe' | 'wallet' | 'manual';

export type RefundPaymentStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'canceled';

export type StripeRefundType =
  | 'cancellation'
  | 'post_delivery_full'
  | 'post_delivery_partial'
  | 'force_admin';

export type ReturnStatus =
  | 'not_required'
  | 'requested'
  | 'in_transit'
  | 'received'
  | 'inspected';

export interface RefundOrderContext {
  id: string;
  order_number: string;
  current_status: string;
  subtotal: number | string;
  base_delivery_fee: number | string;
  per_km_delivery_fee: number | string;
  currency: string;
  completed_at: string | null;
  client_id: string;
  business_id: string;
  business_location_id: string | null;
  payment_source: string | null;
  payment_status: string | null;
  client: { user_id: string };
  business: { user_id: string };
}

export interface RefundPaymentResult {
  success: boolean;
  paymentId?: string;
  destination: RefundDestination;
  status: RefundPaymentStatus;
  async: boolean;
  message: string;
  stripeRefundId?: string;
}

export interface ProcessRefundPaymentParams {
  refundRequestId: string;
  order: RefundOrderContext;
  amount: number;
  refundType: StripeRefundType;
  idempotencySuffix?: string;
  forceDestination?: RefundDestination;
}
