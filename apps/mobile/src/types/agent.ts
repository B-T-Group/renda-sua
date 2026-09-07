/**
 * Types partagés pour les écrans et services agent (alignés backend / web).
 */

export interface OrderItem {
  id: string;
  quantity: number;
  special_instructions?: string;
  item_name?: string;
  variant_name?: string | null;
  variant_snapshot?: { image_url?: string | null } | null;
  unit_price?: number;
  total_price?: number;
  item?: {
    name?: string;
    weight?: number;
    weight_unit?: string;
    dimensions?: string;
    is_fragile?: boolean;
    is_perishable?: boolean;
    item_sub_category?: { name: string; item_category?: { name: string } };
    item_images?: Array<{
      image_url?: string;
      image_type?: string | null;
      display_order?: number | null;
      /** Server-resolved display URL: thumbnail when ready, else image_url. */
      display_url?: string | null;
    }>;
  };
}

export interface Address {
  id: string;
  address_line_1: string;
  address_line_2?: string | null;
  city: string;
  state: string;
  postal_code?: string | null;
  country: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  instructions?: string | null;
}

export interface Client {
  id: string;
  user: { id: string; first_name: string; last_name: string; email?: string; phone_number?: string };
}

export interface Business {
  id: string;
  name: string;
  user: { id: string; first_name: string; last_name: string; email?: string; phone_number?: string };
}

export interface BusinessLocation {
  id: string;
  name: string;
  location_type: string;
  address: Address;
}

export interface Order {
  id: string;
  order_number: string;
  client_id: string;
  business_id: string;
  business_location_id: string;
  assigned_agent_id?: string;
  delivery_address_id: string;
  subtotal?: number;
  base_delivery_fee?: number;
  per_km_delivery_fee?: number;
  tax_amount: number;
  total_amount?: number;
  currency: string;
  current_status: string;
  acceptance_state?: string | null;
  acceptance_deadline_at?: string | null;
  acceptance_activates_at?: string | null;
  grace_deadline_at?: string | null;
  busy_extra_prep_minutes?: number | null;
  estimated_prep_minutes?: number | null;
  estimated_delivery_time?: string;
  actual_delivery_time?: string;
  special_instructions?: string;
  preferred_delivery_time?: string;
  requires_fast_delivery: boolean;
  /** Aligné web / Hasura `users.orders` (agent GET order). */
  payment_method?: string | null;
  payment_timing?: 'pay_now' | 'pay_at_delivery' | 'pay_at_pickup' | string | null;
  payment_source?: 'wallet' | 'mobile_payment' | 'credit_card' | string | null;
  payment_status?: string;
  verified_agent_delivery?: boolean;
  shipping_tracking_number?: string | null;
  shipping_carrier?: string | null;
  shipped_at?: string | null;
  received_at?: string | null;
  created_at: string;
  updated_at: string;
  delivery_commission?: number;
  agent_hold_amount?: number;
  /** Approximate km from agent GPS to pickup (open orders). */
  pickup_distance_km?: number | null;
  client: Client;
  business: Business;
  business_location: BusinessLocation;
  delivery_address: Address;
  order_items: OrderItem[];
  fulfillment_method?: string | null;
  fulfillment_timing?: 'asap' | 'scheduled' | null;
  promised_ready_at?: string | null;
  promised_fulfill_by?: string | null;
  dispatch_ready_at?: string | null;
  pickup_by?: string | null;
  assigned_at?: string | null;
  pickup_due_at?: string | null;
  pickup_state?: string | null;
  pickup_extension_minutes?: number | null;
  pickup_paused_at?: string | null;
  reassignment_count?: number | null;
  dispatch_round?: number | null;
  dispatch_exhausted_at?: string | null;
  completed_at?: string | null;
  assigned_agent?: {
    id: string;
    user_id: string;
    user: { first_name?: string; last_name?: string; email?: string; phone_number?: string };
  };
  order_status_history?: Array<{
    id: string;
    status: string;
    previous_status?: string;
    notes?: string;
    created_at: string;
    changed_by_user?: { first_name?: string; last_name?: string };
  }>;
  delivery_time_window_id?: string | null;
  delivery_time_windows?: Array<{
    id: string;
    preferred_date?: string;
    time_slot_start?: string;
    time_slot_end?: string;
    special_instructions?: string;
    is_confirmed?: boolean | null;
    slot?: { slot_name?: string };
  }>;
}

export interface OpenOrdersResponse {
  success: boolean;
  orders: Order[];
  canClaim?: boolean;
  previewMode?: 'country' | 'region';
  message?: string;
}

export interface OrdersResponse {
  success: boolean;
  orders: Order[];
  message?: string;
}

export interface OrderActionResponse {
  success: boolean;
  order?: Order;
  message: string;
}

export interface OrderCancelResponse {
  success: boolean;
  order?: Order;
  message?: string;
}

export interface CancellationReason {
  id: number;
  value: string;
  display: string;
}

export type RefundType =
  | 'full'
  | 'partial'
  | 'none'
  | 'wallet_credit'
  | 'authorization_release';

export interface CancellationPreview {
  canCancel: boolean;
  reasonIfBlocked?: string;
  refundType: RefundType;
  refundAmount: number;
  refundCurrency: string;
  cancellationFee: number;
  estimatedRefundProcessingTime: string;
  paymentSource: string;
  cancellationConsequences: string[];
  availableCancellationReasons: CancellationReason[];
}

export interface RecentCommission {
  orderId: string;
  orderNumber: string;
  amount: number;
  deliveredAt: string | null;
}

export interface AgentEarningsSummary {
  todayEarnings: number;
  currency: string;
  todayDeliveryCount: number;
  activeOrderCount: number;
  recentCommissions: RecentCommission[];
}

export interface AgentEarningsSummaryResponse {
  success: boolean;
  todayEarnings: number;
  currency: string;
  todayDeliveryCount: number;
  activeOrderCount: number;
  recentCommissions: RecentCommission[];
}

export interface AgentEarnings {
  totalEarnings: number;
  baseDeliveryCommission: number;
  perKmDeliveryCommission: number;
  currency: string;
}

export interface FailedDeliveryReason {
  id: string;
  reason?: string;
  reason_fr?: string;
  reason_en?: string;
  reason_key?: string;
  is_active: boolean;
  sort_order?: number;
}

export interface UserAddress {
  id: string;
  address_line_1: string;
  address_line_2?: string | null;
  city: string;
  state: string;
  postal_code?: string | null;
  country: string;
  is_primary?: boolean;
  address_type?: string;
}
