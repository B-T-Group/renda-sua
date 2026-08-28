export const CREDIT_EVENT_TYPES = [
  'escalation_resolved',
  'business_referred',
  'agent_referred',
  'cancelled_feedback',
  'first_order_completed_feedback',
  'my_first_purchase',
] as const;

export type CreditEventType = (typeof CREDIT_EVENT_TYPES)[number];

export const CREDIT_CONTACT_CHANNELS = [
  'in_app_message',
  'call',
  'email',
  'in_person',
] as const;

export type CreditContactChannel = (typeof CREDIT_CONTACT_CHANNELS)[number];

export const CREDIT_ORDER_RESULTS = [
  'order_cancelled',
  'confirmed',
  'system_cancelled',
] as const;

export type CreditOrderResult = (typeof CREDIT_ORDER_RESULTS)[number];

export const CREDIT_FEEDBACK_ACTIONS = [
  'called_client',
  'emailed_client',
  'spoke_in_person',
  'test_order',
  'internal_order',
] as const;

export type CreditFeedbackAction = (typeof CREDIT_FEEDBACK_ACTIONS)[number];

export const ORDER_OPS_CLASSIFICATIONS = ['test', 'internal'] as const;

export type OrderOpsClassification = (typeof ORDER_OPS_CLASSIFICATIONS)[number];

export const FEEDBACK_ACTION_TO_CHANNEL: Partial<
  Record<CreditFeedbackAction, CreditContactChannel>
> = {
  called_client: 'call',
  emailed_client: 'email',
  spoke_in_person: 'in_person',
};

export const FEEDBACK_ACTION_TO_CLASSIFICATION: Partial<
  Record<CreditFeedbackAction, OrderOpsClassification>
> = {
  test_order: 'test',
  internal_order: 'internal',
};

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
  updated_at?: string | null;
  client_id?: string;
  ops_classification?: OrderOpsClassification | null;
  client?: {
    user_id?: string;
    user?: {
      id?: string;
      first_name: string | null;
      last_name: string | null;
      phone_number: string | null;
      email?: string | null;
      country?: string | null;
    } | null;
  } | null;
  business?: { name: string | null } | null;
  order_items?: CreditsOrderItemBrief[];
}

export interface UserCreditRow {
  id: string;
  user_id: string;
  event_type: CreditEventType;
  weight: number;
  order_id: string | null;
  order_risk_incident_id: string | null;
  referred_business_id: string | null;
  referred_agent_id: string | null;
  contact_channel: CreditContactChannel | null;
  order_result: CreditOrderResult | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

export interface AwardCreditInput {
  userId: string;
  eventType: CreditEventType;
  createdBy?: string | null;
  orderId?: string | null;
  orderRiskIncidentId?: string | null;
  referredBusinessId?: string | null;
  referredAgentId?: string | null;
  contactChannel?: CreditContactChannel | null;
  orderResult?: CreditOrderResult | null;
  notes?: string | null;
}

export interface OrderRiskIncidentLite {
  id: string;
  order_id: string;
  resolved_at: string | null;
}
