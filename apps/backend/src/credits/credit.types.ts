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
] as const;

export type CreditContactChannel = (typeof CREDIT_CONTACT_CHANNELS)[number];

export const CREDIT_ORDER_RESULTS = [
  'order_cancelled',
  'confirmed',
  'system_cancelled',
] as const;

export type CreditOrderResult = (typeof CREDIT_ORDER_RESULTS)[number];

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
