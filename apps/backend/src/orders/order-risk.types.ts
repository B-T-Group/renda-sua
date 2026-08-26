export const ORDER_RISK_TYPES = [
  'pending_acceptance',
  'ready_unassigned',
  'pickup_overdue',
  'delivery_delayed',
] as const;

export type OrderRiskType = (typeof ORDER_RISK_TYPES)[number];

export const ORDER_RISK_SEVERITIES = ['warning', 'critical'] as const;

export type OrderRiskSeverity = (typeof ORDER_RISK_SEVERITIES)[number];

/** Statuses where the parcel is with an agent and the client is still waiting. */
export const IN_DELIVERY_STATUSES = [
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'in_delivery',
] as const;

export interface OrderRiskConfig {
  alertsEnabled: boolean;
  minSeverity: OrderRiskSeverity;
  alertRepeatMinutes: number;
  pendingAcceptanceGraceMinutes: number;
  pendingFallbackMinutes: number;
  readyUnassignedMinutes: number;
  pickupOverdueGraceMinutes: number;
  deliveryDelayedMinutes: number;
  criticalAfterMinutes: number;
}

export const DEFAULT_ORDER_RISK_CONFIG: OrderRiskConfig = {
  alertsEnabled: true,
  minSeverity: 'warning',
  alertRepeatMinutes: 60,
  pendingAcceptanceGraceMinutes: 5,
  pendingFallbackMinutes: 30,
  readyUnassignedMinutes: 30,
  pickupOverdueGraceMinutes: 10,
  deliveryDelayedMinutes: 60,
  criticalAfterMinutes: 60,
};

/** Order fields the risk rules read. Mirrors the monitor + admin queries. */
export interface RiskEvaluableOrder {
  id: string;
  order_number?: string | null;
  current_status: string;
  fulfillment_method?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  acceptance_state?: string | null;
  acceptance_deadline_at?: string | null;
  grace_deadline_at?: string | null;
  assigned_agent_id?: string | null;
  assigned_at?: string | null;
  pickup_state?: string | null;
  pickup_due_at?: string | null;
  agent_arrived_pickup_at?: string | null;
  estimated_delivery_time?: string | null;
  promised_fulfill_by?: string | null;
  delivery_time_window?: {
    preferred_date?: string | null;
    time_slot_end?: string | null;
  } | null;
}

export interface OrderRiskFinding {
  riskType: OrderRiskType;
  severity: OrderRiskSeverity;
  /** Minutes elapsed past the deadline that defines this risk. */
  overdueMinutes: number;
  /** The deadline that was missed, when one exists. */
  dueAt: string | null;
  reason: string;
}

export interface OrderRiskIncident {
  id: string;
  order_id: string;
  risk_type: OrderRiskType;
  severity: OrderRiskSeverity;
  detected_at: string;
  last_seen_at: string;
  resolved_at: string | null;
  resolution: string | null;
  due_at: string | null;
  overdue_minutes: number;
  context: Record<string, unknown>;
  last_notified_at: string | null;
  last_notified_severity: OrderRiskSeverity | null;
  notified_count: number;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  acknowledged_note: string | null;
}

export function severityRank(severity: OrderRiskSeverity): number {
  return severity === 'critical' ? 2 : 1;
}

export function isOrderRiskSeverity(
  value: unknown
): value is OrderRiskSeverity {
  return ORDER_RISK_SEVERITIES.includes(value as OrderRiskSeverity);
}

export function isOrderRiskType(value: unknown): value is OrderRiskType {
  return ORDER_RISK_TYPES.includes(value as OrderRiskType);
}
