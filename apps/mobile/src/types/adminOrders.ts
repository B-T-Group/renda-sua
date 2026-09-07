export type OrderRiskType =
  | 'pending_acceptance'
  | 'prep_overdue'
  | 'ready_unassigned'
  | 'pickup_uncollected'
  | 'pickup_overdue'
  | 'delivery_delayed';

export type OrderRiskSeverity = 'warning' | 'critical';

export type AdminOrderRiskLevel = 'none' | OrderRiskSeverity;

export type AdminOrderNextAction =
  | 'contact_business'
  | 'contact_agent'
  | 'redispatch'
  | 'contact_client'
  | 'none';

export type OrderContactRole = 'client' | 'business' | 'agent';

export type AdminOrderQueue = 'at_risk' | 'all';

export interface AdminOrderContact {
  role: OrderContactRole;
  name: string | null;
  email: string | null;
  phone: string | null;
  user_id: string | null;
  can_message: boolean;
  can_email: boolean;
  can_sms: boolean;
}

export interface AdminOrderRiskIncident {
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
  status_changed_at: string | null;
  acceptance_deadline_at: string | null;
  promised_ready_at: string | null;
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
  risk_incidents: AdminOrderRiskIncident[];
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

export interface AdminOrderTimelineEvent {
  id: string;
  event_type: string;
  actor_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface AdminOrderMessage {
  id: string;
  message: string;
  created_at: string;
  sender_name: string | null;
  recipient_types: string[];
}

export interface AdminOrderDetail extends AdminOrderRow {
  timeline: AdminOrderTimelineEvent[];
  messages: AdminOrderMessage[];
  resolved_incidents: AdminOrderRiskIncident[];
}

export interface AdminOrdersQueueCounts {
  total: number;
  at_risk: number;
  critical: number;
  warning: number;
}

export interface AdminOrdersListResult {
  orders: AdminOrderRow[];
  total: number;
  offset: number;
  limit: number;
  counts: AdminOrdersQueueCounts;
}
