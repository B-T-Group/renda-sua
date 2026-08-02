export type OrderPickupState =
  | 'monitoring'
  | 'reminded'
  | 'at_risk'
  | 'overdue'
  | 'reassigning'
  | 'paused'
  | 'recovered';

export type PickupPauseReason =
  | 'merchant_delay'
  | 'support_hold'
  | 'agent_reported_merchant_delay';

export type OrderEventType =
  | 'agent_assigned'
  | 'pickup_reminder_sent'
  | 'pickup_at_risk'
  | 'pickup_overdue'
  | 'agent_extension_requested'
  | 'agent_arrived_pickup'
  | 'agent_reported_issue'
  | 'merchant_delay_started'
  | 'merchant_delay_ended'
  | 'support_hold_started'
  | 'support_hold_ended'
  | 'gps_unavailable'
  | 'reassignment_started'
  | 'reassigned'
  | 'reassignment_pool_empty'
  | 'customer_notified_delay'
  | 'address_changed_post_assignment';

export type OrderEventActorType =
  | 'client'
  | 'business'
  | 'agent'
  | 'system'
  | 'support';

export interface PickupMonitorConfig {
  pickupSlaMinutes: number;
  reminderMinutesBefore: number;
  overdueGraceMinutes: number;
  reassignmentGraceMinutes: number;
  extensionMinutes: number;
  geofenceMeters: number;
  approachDeltaMeters: number;
  gpsStaleMinutes: number;
  autoReassignmentEnabled: boolean;
  maxReassignments: number;
}

export interface PickupProgressResult {
  distanceMeters: number | null;
  previousDistanceMeters: number | null;
  isApproaching: boolean;
  isArrived: boolean;
  gpsUnavailable: boolean;
  etaMinutes: number | null;
  shouldDeferEscalation: boolean;
}

export interface MonitoredPickupOrder {
  id: string;
  order_number: string;
  current_status: string;
  assigned_agent_id: string | null;
  assigned_at: string | null;
  pickup_by: string | null;
  pickup_due_at: string | null;
  pickup_state: OrderPickupState | null;
  pickup_extension_minutes: number | null;
  pickup_paused_at: string | null;
  pickup_pause_reason: string | null;
  pickup_pause_remaining_ms: number | null;
  reassignment_count: number | null;
  last_agent_distance_m: number | null;
  last_agent_progress_at: string | null;
  agent_arrived_pickup_at: string | null;
  estimated_delivery_time?: string | null;
  business_id: string;
  client?: {
    user_id?: string;
    user?: {
      preferred_language?: string | null;
      email?: string | null;
      first_name?: string | null;
    } | null;
  } | null;
  business?: {
    user_id?: string;
    name?: string | null;
    user?: {
      preferred_language?: string | null;
      email?: string | null;
    } | null;
  } | null;
  assigned_agent?: {
    id: string;
    user_id?: string;
    user?: {
      preferred_language?: string | null;
      first_name?: string | null;
    } | null;
  } | null;
  business_location?: {
    id?: string;
    address?: {
      latitude?: number | null;
      longitude?: number | null;
    } | null;
  } | null;
}

export const DEFAULT_PICKUP_MONITOR_CONFIG: PickupMonitorConfig = {
  pickupSlaMinutes: 20,
  reminderMinutesBefore: 5,
  overdueGraceMinutes: 10,
  reassignmentGraceMinutes: 20,
  extensionMinutes: 10,
  geofenceMeters: 150,
  approachDeltaMeters: 150,
  gpsStaleMinutes: 10,
  autoReassignmentEnabled: false,
  maxReassignments: 2,
};
