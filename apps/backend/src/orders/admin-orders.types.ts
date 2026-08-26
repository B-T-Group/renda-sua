import type {
  OrderRiskSeverity,
  OrderRiskType,
} from './order-risk.types';

export type AdminOrderRiskLevel = 'none' | OrderRiskSeverity;

/** Intervention the operator should try first for the leading risk. */
export type AdminOrderNextAction =
  | 'contact_business'
  | 'contact_agent'
  | 'redispatch'
  | 'contact_client'
  | 'none';

export interface AdminOrderContact {
  role: 'client' | 'business' | 'agent';
  name: string | null;
  email: string | null;
  phone: string | null;
  user_id: string | null;
  /** In-app messaging needs a user id; email/SMS need the matching field. */
  can_message: boolean;
  can_email: boolean;
  can_sms: boolean;
}

export interface AdminOrderRiskIncidentView {
  id: string;
  risk_type: OrderRiskType;
  severity: OrderRiskSeverity;
  detected_at: string;
  last_seen_at: string;
  due_at: string | null;
  overdue_minutes: number;
  reason: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  acknowledged_note: string | null;
  notified_count: number;
  last_notified_at: string | null;
}

export interface AdminOrderTiming {
  created_at: string | null;
  updated_at: string | null;
  acceptance_deadline_at: string | null;
  pickup_due_at: string | null;
  estimated_delivery_time: string | null;
  promised_fulfill_by: string | null;
  delivery_window_end: string | null;
}

export interface AdminOrderCapabilities {
  can_redispatch: boolean;
  can_message_client: boolean;
  can_message_business: boolean;
  can_message_agent: boolean;
  can_force_status: boolean;
}

export interface AdminOrderRow {
  id: string;
  order_number: string;
  current_status: string;
  fulfillment_method: string | null;
  total_amount: number | null;
  currency: string | null;
  pickup_state: string | null;
  risk_level: AdminOrderRiskLevel;
  risk_since: string | null;
  risk_type: OrderRiskType | null;
  risk_summary: string | null;
  risk_acknowledged: boolean;
  next_action: AdminOrderNextAction;
  risk_incidents: AdminOrderRiskIncidentView[];
  contacts: AdminOrderContact[];
  timing: AdminOrderTiming;
  capabilities: AdminOrderCapabilities;
  business_location: {
    id: string | null;
    name: string | null;
    phone: string | null;
    email: string | null;
  } | null;
  delivery_address: {
    address_line_1: string | null;
    city: string | null;
    state: string | null;
  } | null;
}

export interface AdminOrdersQueueCounts {
  total: number;
  at_risk: number;
  critical: number;
  warning: number;
}

export interface AdminOrdersResponse {
  orders: AdminOrderRow[];
  total: number;
  counts: AdminOrdersQueueCounts;
  offset: number;
  limit: number;
}

export interface AdminOrderDetail extends AdminOrderRow {
  timeline: Array<{
    id: string;
    event_type: string;
    actor_type: string;
    payload: Record<string, unknown>;
    created_at: string;
  }>;
  messages: Array<{
    id: string;
    message: string;
    created_at: string;
    sender_name: string | null;
    recipient_types: string[];
  }>;
  resolved_incidents: AdminOrderRiskIncidentView[];
}
