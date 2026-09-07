export interface IncomingOrderDeliveryWindow {
  id: string;
  preferred_date?: string;
  time_slot_start?: string;
  time_slot_end?: string;
  special_instructions?: string;
  is_confirmed?: boolean | null;
  slot?: { slot_name?: string };
}

export interface IncomingOrderDetails {
  id: string;
  order_number: string;
  current_status: string;
  acceptance_state: string | null;
  acceptance_deadline_at: string | null;
  acceptance_activates_at?: string | null;
  grace_deadline_at: string | null;
  busy_extra_prep_minutes: number;
  estimated_prep_minutes: number | null;
  created_at: string;
  total_amount: number;
  currency: string;
  fulfillment_method?: string | null;
  fulfillment_timing?: 'asap' | 'scheduled' | null;
  promised_ready_at?: string | null;
  promised_fulfill_by?: string | null;
  business_id: string;
  client?: {
    user?: {
      first_name?: string | null;
      last_name?: string | null;
    } | null;
  } | null;
  order_items?: Array<{
    id?: string;
    item_name?: string | null;
    quantity?: number | null;
    variant_snapshot?: { image_url?: string | null } | null;
    item?: {
      name?: string | null;
      item_images?: Array<{
        image_url?: string | null;
        image_type?: string | null;
        display_url?: string | null;
      }> | null;
    } | null;
  }>;
  delivery_time_windows?: IncomingOrderDeliveryWindow[];
}

export interface IncomingOrderPendingResponse {
  active: boolean;
  order: IncomingOrderDetails | null;
}
