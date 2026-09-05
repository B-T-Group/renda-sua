import { DateTime } from 'luxon';
import {
  IN_DELIVERY_STATUSES,
  PREPARING_STATUSES,
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
    prepOverdueRisk(order, config, now),
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
  if (order.acceptance_state === 'scheduled') {
    return scheduledActivationRisk(order, config, now);
  }
  if (isGraceState(order.acceptance_state)) {
    return graceAcceptanceRisk(order, config, now);
  }
  return awaitingAcceptanceRisk(order, config, now);
}

/**
 * The merchant is still inside the confirm window, so only the buffer we owe
 * them past the deadline (or plain age when no timer ever started) counts.
 */
function awaitingAcceptanceRisk(
  order: RiskEvaluableOrder,
  config: OrderRiskConfig,
  now: DateTime
): OrderRiskFinding | null {
  const deadline = toDateTime(order.acceptance_deadline_at);
  const reference =
    deadline ??
    toDateTime(order.created_at)?.plus({ minutes: config.pendingFallbackMinutes });
  if (!reference) return null;

  const buffer = deadline ? config.pendingAcceptanceGraceMinutes : 0;
  const overdueMinutes = minutesBetween(reference.plus({ minutes: buffer }), now);
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

/**
 * Grace is the last window before the system auto-declines and refunds, so ops
 * is alerted the moment it starts. Waiting for `grace_deadline_at` would only
 * surface the order once it had already been cancelled.
 */
function graceAcceptanceRisk(
  order: RiskEvaluableOrder,
  config: OrderRiskConfig,
  now: DateTime
): OrderRiskFinding | null {
  const dueAt =
    toDateTime(order.acceptance_deadline_at) ??
    toDateTime(order.grace_deadline_at) ??
    statusSince(order);
  if (!dueAt) return null;

  const overdueMinutes = Math.max(0, minutesBetween(dueAt, now));
  return {
    riskType: 'pending_acceptance',
    severity: severityFor(overdueMinutes, config.criticalAfterMinutes),
    overdueMinutes,
    dueAt: dueAt.toISO(),
    reason: overdueMinutes
      ? `Merchant has not confirmed ${formatMinutes(overdueMinutes)} past the acceptance deadline, final grace before auto-decline`
      : 'Merchant missed the acceptance deadline, final grace before auto-decline',
  };
}

/**
 * A scheduled order should leave `scheduled` once acceptance_activates_at passes.
 * When it does not, the confirmation timer never starts and the order would
 * otherwise stay invisible to every other rule.
 */
function scheduledActivationRisk(
  order: RiskEvaluableOrder,
  config: OrderRiskConfig,
  now: DateTime
): OrderRiskFinding | null {
  const activatesAt = toDateTime(order.acceptance_activates_at);
  if (!activatesAt) return null;

  const dueAt = activatesAt.plus({
    minutes: config.scheduledActivationGraceMinutes,
  });
  const overdueMinutes = minutesBetween(dueAt, now);
  if (overdueMinutes <= 0) return null;
  return {
    riskType: 'pending_acceptance',
    severity: severityFor(overdueMinutes, config.criticalAfterMinutes),
    overdueMinutes,
    dueAt: activatesAt.toISO(),
    reason: `Scheduled order passed its start time ${formatMinutes(
      overdueMinutes + config.scheduledActivationGraceMinutes
    )} ago but the confirmation timer never started`,
  };
}

/** Merchant confirmed the order but never got it ready. */
export function prepOverdueRisk(
  order: RiskEvaluableOrder,
  config: OrderRiskConfig,
  now: DateTime
): OrderRiskFinding | null {
  if (!PREPARING_STATUSES.includes(order.current_status as never)) return null;
  const promised = toDateTime(order.promised_ready_at);
  const since = toDateTime(order.accepted_at) ?? statusSince(order);
  const dueAt =
    promised ?? since?.plus({ minutes: config.prepOverdueMinutes }) ?? null;
  if (!dueAt) return null;

  const overdueMinutes = minutesBetween(dueAt, now);
  if (overdueMinutes <= 0) return null;
  return {
    riskType: 'prep_overdue',
    severity: severityFor(overdueMinutes, config.criticalAfterMinutes),
    overdueMinutes,
    dueAt: dueAt.toISO(),
    reason: promised
      ? `Order is ${formatMinutes(overdueMinutes)} past the promised ready time`
      : `Confirmed but still not ready after ${formatMinutes(
          overdueMinutes + config.prepOverdueMinutes
        )}`,
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
  const readySince = statusSince(order);
  if (!readySince) return null;

  const dueAt = readySince.plus({ minutes: config.readyUnassignedMinutes });
  const overdueMinutes = minutesBetween(dueAt, now);
  if (overdueMinutes <= 0) return null;
  // Dispatch already offered this to everyone nearby and nobody took it, so no
  // amount of waiting will fix it on its own.
  const exhausted = !!order.dispatch_exhausted_at;
  return {
    riskType: 'ready_unassigned',
    severity: exhausted
      ? 'critical'
      : severityFor(overdueMinutes, config.criticalAfterMinutes),
    overdueMinutes,
    dueAt: dueAt.toISO(),
    reason: exhausted
      ? `Dispatch found no agent after ${formatMinutes(
          overdueMinutes + config.readyUnassignedMinutes
        )} ready for pickup`
      : `Ready for pickup with no agent assigned for ${formatMinutes(
          overdueMinutes + config.readyUnassignedMinutes
        )}`,
  };
}

/**
 * Pickup/shipping sitting in ready_for_pickup is intentionally not escalated.
 * Only delivery ready_unassigned (no agent) raises risk for that status.
 * Kept as a no-op so callers/tests do not reintroduce the old rule by accident.
 */
export function pickupUncollectedRisk(
  _order: RiskEvaluableOrder,
  _config: OrderRiskConfig,
  _now: DateTime
): OrderRiskFinding | null {
  return null;
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
    statusSince(order)?.plus({ minutes: config.deliveryDelayedMinutes });
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

/**
 * How long the order has held its current status. `updated_at` is deliberately
 * not consulted: a BEFORE UPDATE trigger on orders resets it on every write, so
 * agent pings and monitor bookkeeping would keep pushing these deadlines out of
 * reach. `created_at` only backstops rows written before the anchor existed.
 */
function statusSince(order: RiskEvaluableOrder): DateTime | null {
  return toDateTime(order.status_changed_at) ?? toDateTime(order.created_at);
}

/** Merchant blew the confirm deadline and is on the final countdown. */
function isGraceState(state?: string | null): boolean {
  return state === 'grace' || state === 'no_response';
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
