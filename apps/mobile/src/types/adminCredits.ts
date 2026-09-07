export type CreditEventType =
  | 'escalation_resolved'
  | 'business_referred'
  | 'agent_referred'
  | 'cancelled_feedback'
  | 'first_order_completed_feedback'
  | 'my_first_purchase';

export type CreditContactChannel =
  | 'in_app_message'
  | 'call'
  | 'email'
  | 'in_person';

export type CreditOrderResult =
  | 'order_cancelled'
  | 'confirmed'
  | 'system_cancelled';

export type CreditFeedbackAction =
  | 'called_client'
  | 'called_business'
  | 'emailed_client'
  | 'spoke_in_person'
  | 'test_order'
  | 'internal_order';

export type AdminCreditsTab =
  | 'escalations'
  | 'cancelled'
  | 'first_order'
  | 'progress';

export interface CreditsSummaryRow {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  country?: string | null;
  total_weight: number;
  credit_count: number;
  by_event: Record<string, { count: number; weight: number }>;
  is_agent: boolean;
  is_business: boolean;
}

export interface CreditsSummaryResponse {
  items: CreditsSummaryRow[];
  total: number;
  weights: Record<CreditEventType, number>;
}

export interface CreditsQueuePage<T> {
  items: T[];
  total: number;
}

export interface CreditsEscalationRow {
  id: string;
  order_id: string;
  risk_type: string;
  severity: string;
  detected_at: string;
  overdue_minutes: number;
  acknowledged_at: string | null;
  order?: {
    id: string;
    order_number: string;
    current_status: string;
    client?: {
      user?: {
        first_name: string | null;
        last_name: string | null;
        phone_number: string | null;
        email?: string | null;
        country?: string | null;
      } | null;
    } | null;
    business?: {
      name: string | null;
      user?: {
        first_name: string | null;
        last_name: string | null;
        phone_number: string | null;
      } | null;
    } | null;
    order_items?: CreditsOrderItemBrief[];
  } | null;
}

export interface CreditsOrderItemBrief {
  item_name: string | null;
  quantity: number;
  variant_name: string | null;
  image_url?: string | null;
}

export interface CreditsFeedbackOrderRow {
  id: string;
  order_number: string;
  current_status: string;
  fulfillment_method?: string | null;
  cancelled_at?: string | null;
  completed_at?: string | null;
  cancellation_notes?: string | null;
  cancelled_by?: string | null;
  updated_at?: string | null;
  client?: {
    user_id?: string;
    user?: {
      first_name: string | null;
      last_name: string | null;
      phone_number: string | null;
      email?: string | null;
      country?: string | null;
    } | null;
  } | null;
  business?: {
    name: string | null;
    user?: {
      first_name: string | null;
      last_name: string | null;
      phone_number: string | null;
      email?: string | null;
    } | null;
  } | null;
  order_items?: CreditsOrderItemBrief[];
}

export interface ResolveEscalationCreditBody {
  contact_channel: CreditContactChannel;
  order_result: CreditOrderResult;
  notes: string;
}

export interface OrderFeedbackCreditBody {
  action: CreditFeedbackAction;
  notes: string;
}
