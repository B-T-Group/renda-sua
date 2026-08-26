import type {
  AdminOrderCapabilities,
  AdminOrderContact,
  AdminOrderNextAction,
  AdminOrderRiskIncidentView,
  AdminOrderRiskLevel,
  AdminOrderRow,
  AdminOrderTiming,
} from './admin-orders.types';
import type { OrderRiskIncident, OrderRiskType } from './order-risk.types';

const NEXT_ACTION_BY_RISK: Record<OrderRiskType, AdminOrderNextAction> = {
  pending_acceptance: 'contact_business',
  prep_overdue: 'contact_business',
  ready_unassigned: 'redispatch',
  pickup_uncollected: 'contact_client',
  pickup_overdue: 'contact_agent',
  delivery_delayed: 'contact_agent',
};

const REDISPATCHABLE_STATUSES = ['assigned_to_agent', 'ready_for_pickup'];

/** Store-pickup orders never involve an agent, so there is nothing to dispatch. */
function canRedispatch(order: any): boolean {
  if (!REDISPATCHABLE_STATUSES.includes(order.current_status)) return false;
  return order.fulfillment_method !== 'pickup';
}

export function mapAdminOrderRow(order: any): AdminOrderRow {
  const incidents = mapIncidents(order.risk_incidents ?? []);
  const leading = incidents[0] ?? null;
  return {
    id: order.id,
    order_number: order.order_number,
    current_status: order.current_status,
    fulfillment_method: order.fulfillment_method ?? null,
    total_amount: order.total_amount ?? null,
    currency: order.currency ?? null,
    pickup_state: order.pickup_state ?? null,
    risk_level: riskLevel(order.open_risk_rank ?? 0),
    risk_since: order.open_risk_since ?? null,
    risk_type: leading?.risk_type ?? order.open_risk_type ?? null,
    risk_summary: leading?.reason ?? null,
    risk_acknowledged: incidents.every((i) => !!i.acknowledged_at),
    next_action: leading ? NEXT_ACTION_BY_RISK[leading.risk_type] : 'none',
    risk_incidents: incidents,
    contacts: mapContacts(order),
    timing: mapTiming(order),
    capabilities: mapCapabilities(order),
    business_location: mapBusinessLocation(order),
    delivery_address: mapDeliveryAddress(order),
  };
}

export function mapIncidents(rows: OrderRiskIncident[]): AdminOrderRiskIncidentView[] {
  return rows
    .map((row) => ({
      id: row.id,
      risk_type: row.risk_type,
      severity: row.severity,
      detected_at: row.detected_at,
      last_seen_at: row.last_seen_at,
      due_at: row.due_at,
      overdue_minutes: row.overdue_minutes,
      reason: String((row.context as any)?.reason ?? ''),
      acknowledged_at: row.acknowledged_at,
      acknowledged_by: row.acknowledged_by,
      acknowledged_note: row.acknowledged_note,
      notified_count: row.notified_count,
      last_notified_at: row.last_notified_at,
    }))
    .sort(bySeverityThenAge);
}

function bySeverityThenAge(
  a: AdminOrderRiskIncidentView,
  b: AdminOrderRiskIncidentView
): number {
  if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1;
  return a.detected_at.localeCompare(b.detected_at);
}

function riskLevel(rank: number): AdminOrderRiskLevel {
  if (rank >= 2) return 'critical';
  if (rank === 1) return 'warning';
  return 'none';
}

function mapContacts(order: any): AdminOrderContact[] {
  return [
    buildContact('client', order.client?.user, fullName(order.client?.user)),
    buildContact(
      'business',
      order.business?.user,
      order.business?.name ?? fullName(order.business?.user),
      order.business_location?.phone,
      order.business_location?.email
    ),
    buildContact(
      'agent',
      order.assigned_agent?.user,
      fullName(order.assigned_agent?.user)
    ),
  ].filter((contact): contact is AdminOrderContact => !!contact);
}

function buildContact(
  role: AdminOrderContact['role'],
  user: any,
  name: string | null,
  fallbackPhone?: string | null,
  fallbackEmail?: string | null
): AdminOrderContact | null {
  const email = user?.email ?? fallbackEmail ?? null;
  const phone = user?.phone_number ?? fallbackPhone ?? null;
  if (!user?.id && !email && !phone) return null;
  return {
    role,
    name: name || null,
    email,
    phone,
    user_id: user?.id ?? null,
    can_message: !!user?.id,
    can_email: !!email,
    can_sms: !!phone,
  };
}

function fullName(user: any): string | null {
  const name = `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim();
  return name || null;
}

function mapTiming(order: any): AdminOrderTiming {
  return {
    created_at: order.created_at ?? null,
    updated_at: order.updated_at ?? null,
    status_changed_at: order.status_changed_at ?? null,
    acceptance_deadline_at: order.acceptance_deadline_at ?? null,
    promised_ready_at: order.promised_ready_at ?? null,
    pickup_due_at: order.pickup_due_at ?? null,
    estimated_delivery_time: order.estimated_delivery_time ?? null,
    promised_fulfill_by: order.promised_fulfill_by ?? null,
    delivery_window_end: deliveryWindowEnd(order.delivery_time_window),
  };
}

function deliveryWindowEnd(window: any): string | null {
  if (!window?.preferred_date || !window?.time_slot_end) return null;
  return `${window.preferred_date}T${window.time_slot_end}`;
}

function mapCapabilities(order: any): AdminOrderCapabilities {
  return {
    can_redispatch: canRedispatch(order),
    can_message_client: !!order.client?.user?.id,
    can_message_business: !!order.business?.user?.id,
    can_message_agent: !!order.assigned_agent?.user?.id,
    can_force_status: true,
  };
}

function mapBusinessLocation(order: any): AdminOrderRow['business_location'] {
  const location = order.business_location;
  if (!location) return null;
  return {
    id: location.id ?? null,
    name: location.name ?? null,
    phone: location.phone ?? null,
    email: location.email ?? null,
  };
}

function mapDeliveryAddress(order: any): AdminOrderRow['delivery_address'] {
  const address = order.delivery_address;
  if (!address) return null;
  return {
    address_line_1: address.address_line_1 ?? null,
    city: address.city ?? null,
    state: address.state ?? null,
  };
}
