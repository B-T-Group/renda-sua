export type OrderAcceptanceState =
  | 'scheduled'
  | 'awaiting_acceptance'
  | 'no_response'
  | 'grace'
  | 'accepted';

export const CONFIRMABLE_ACCEPTANCE_STATES: OrderAcceptanceState[] = [
  'scheduled',
  'awaiting_acceptance',
  'no_response',
  'grace',
];

export const ACTIVATION_LEAD_MINUTES_ALLOWED = [30, 60, 120] as const;

export const MERCHANT_NO_RESPONSE_REASON_ID = 19;

export type ReliabilityTier = 'ok' | 'warn' | 'demote' | 'restrict' | 'suspend';

export interface PendingAcceptanceOrder {
  id: string;
  order_number: string;
  current_status: string;
  acceptance_state: OrderAcceptanceState | null;
  acceptance_deadline_at: string | null;
  grace_deadline_at: string | null;
  busy_extra_prep_minutes: number;
  estimated_prep_minutes: number | null;
  created_at: string;
  total_amount: number;
  currency: string;
  fulfillment_method?: string | null;
  business_id: string;
  client?: {
    user?: {
      first_name?: string | null;
      last_name?: string | null;
    } | null;
  } | null;
  order_items?: Array<{
    item_name?: string | null;
    quantity?: number | null;
  }>;
}
