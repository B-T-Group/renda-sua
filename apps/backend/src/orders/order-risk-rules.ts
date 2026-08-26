import { DateTime } from 'luxon';
import {
  IN_DELIVERY_STATUSES,
  type OrderRiskConfig,
  type OrderRiskFinding,
  type OrderRiskSeverity,
  type RiskEvaluableOrder,
} from './order-risk.types';

/**
 * Single source of truth for "this order needs a human". The admin queue and the
 * risk monitor both call this so a row never disagrees with the open incident.
 */
export function evaluateOrderRisk(
  order: RiskEvaluableOrder,
  config: OrderRiskConfig,
  now: DateTime = DateTime.utc()
): OrderRiskFinding[] {
  const findings = [
    pendingAcceptanceRisk(order, config, now),
    readyUnassignedRisk(order, config, now),
    pickupOverdueRisk(order, config, now),
    deliveryDelayedRisk(order, config, now),
  ];
  return findings.filter((finding): finding is OrderRiskFinding => !!finding);
}

/** Merchant never confirmed the order in time. */
export function pendingAcceptanceRisk(
  order: RiskEvaluableOrder,
  config: OrderRiskConfig,
  now: DateTime
): OrderRiskFinding | null {
  if (order.current_status !== 'pending') return null;
  if (order.acceptance_state === 'scheduled') return null;
  const deadline = toDateTime(order.acceptance_deadline_at);
  const grace = deadline ? config.pendingAcceptanceGraceMinutes : 0;
  const reference =
    deadline ??
    toDateTime(order.created_at)?.plus({ minutes: config.pendingFallbackMinutes });
  if (!reference) return null;

  const overdueMinutes = minutesBetween(reference.plus({ minutes: grace }), now);
  if (overdueMinutes <= 0) return null;
  return {
    riskType: 'pending_acceptance',
    severity: severityFor(overdueMinutes, config.criticalAfterMinutes),
    overdueMinutes,
    dueAt: reference.toISO(),
    reason: deadline
      ? `Merchant has not confirmed ${formatMinutes(overdueMinutes)} past the acceptance deadline`
      : `Order has been pending confirmation for ${formatMinutes(overdueMinutes + config.pendingFallbackMinutes)}`,
  };
}

/** Delivery order is ready but no agent has taken it. */
export function readyUnassignedRisk(
  order: RiskEvaluableOrder,
  config: OrderRiskConfig,
  now: DateTime
): OrderRiskFinding | null {
  if (order.current_status !== 'ready_for_pickup') return null;
  if (!isDeliveryOrder(order) || order.assigned_agent_id) return null;
  const readySince = toDateTime(order.updated_at ?? order.created_at);
  if (!readySince) return null;

  const dueAt = readySince.plus({ minutes: config.readyUnassignedMinutes });
  const overdueMinutes = minutesBetween(dueAt, now);
  if (overdueMinutes <= 0) return null;
  return {
    riskType: 'ready_unassigned',
    severity: severityFor(overdueMinutes, config.criticalAfterMinutes),
    overdueMinutes,
    dueAt: dueAt.toISO(),
    reason: `Ready for pickup with no agent assigned for ${formatMinutes(
      overdueMinutes + config.readyUnassignedMinutes
    )}`,
  };
}

/** An agent accepted the delivery but has not collected the parcel. */
export function pickupOverdueRisk(
  order: RiskEvaluableOrder,
  config: OrderRiskConfig,
  now: DateTime
): OrderRiskFinding | null {
  if (order.current_status !== 'assigned_to_agent') return null;
  if (order.pickup_state === 'paused' || order.agent_arrived_pickup_at) {
    return null;
  }
  const dueAt = toDateTime(order.pickup_due_at) ?? assignedFallbackDue(order, config);
  if (!dueAt) return null;

  const overdueMinutes = minutesBetween(
    dueAt.plus({ minutes: config.pickupOverdueGraceMinutes }),
    now
  );
  if (overdueMinutes <= 0) return null;
  return {
    riskType: 'pickup_overdue',
    severity: severityFor(overdueMinutes, config.criticalAfterMinutes),
    overdueMinutes,
    dueAt: dueAt.toISO(),
    reason: `Assigned agent has not picked up, ${formatMinutes(overdueMinutes)} past the pickup deadline`,
  };
}

/** Parcel is with the agent but the client is still waiting past the promise. */
export function deliveryDelayedRisk(
  order: RiskEvaluableOrder,
  config: OrderRiskConfig,
  now: DateTime
): OrderRiskFinding | null {
  if (!IN_DELIVERY_STATUSES.includes(order.current_status as never)) return null;
  const promised = earliestPromise(order);
  const dueAt =
    promised ??
    toDateTime(order.updated_at)?.plus({ minutes: config.deliveryDelayedMinutes });
  if (!dueAt) return null;

  const overdueMinutes = minutesBetween(dueAt, now);
  if (overdueMinutes <= 0) return null;
  return {
    riskType: 'delivery_delayed',
    severity: severityFor(overdueMinutes, config.criticalAfterMinutes),
    overdueMinutes,
    dueAt: dueAt.toISO(),
    reason: promised
      ? `Delivery is ${formatMinutes(overdueMinutes)} past the promised arrival`
      : `Out for delivery for ${formatMinutes(
          overdueMinutes + config.deliveryDelayedMinutes
        )} with no ETA`,
  };
}

export function severityFor(
  overdueMinutes: number,
  criticalAfterMinutes: number
): OrderRiskSeverity {
  return overdueMinutes >= criticalAfterMinutes ? 'critical' : 'warning';
}

export function formatMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  if (hours < 24) return `${hours}h ${total % 60}min`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function isDeliveryOrder(order: RiskEvaluableOrder): boolean {
  return (order.fulfillment_method ?? 'delivery') === 'delivery';
}

function assignedFallbackDue(
  order: RiskEvaluableOrder,
  config: OrderRiskConfig
): DateTime | null {
  const assignedAt = toDateTime(order.assigned_at);
  if (!assignedAt) return null;
  return assignedAt.plus({ minutes: config.deliveryDelayedMinutes });
}

/** Soonest commitment we made to the client for this delivery. */
function earliestPromise(order: RiskEvaluableOrder): DateTime | null {
  const candidates = [
    toDateTime(order.estimated_delivery_time),
    toDateTime(order.promised_fulfill_by),
    deliveryWindowEnd(order),
  ].filter((value): value is DateTime => !!value);
  if (!candidates.length) return null;
  return candidates.reduce((min, current) => (current < min ? current : min));
}

function deliveryWindowEnd(order: RiskEvaluableOrder): DateTime | null {
  const window = order.delivery_time_window;
  if (!window?.preferred_date || !window?.time_slot_end) return null;
  const time =
    window.time_slot_end.length === 5
      ? `${window.time_slot_end}:00`
      : window.time_slot_end;
  const combined = DateTime.fromISO(`${window.preferred_date}T${time}`, {
    zone: 'utc',
  });
  return combined.isValid ? combined : null;
}

function toDateTime(value?: string | null): DateTime | null {
  if (!value) return null;
  const parsed = DateTime.fromISO(value, { zone: 'utc' });
  return parsed.isValid ? parsed : null;
}

function minutesBetween(from: DateTime, to: DateTime): number {
  return Math.floor(to.diff(from, 'minutes').minutes);
}
