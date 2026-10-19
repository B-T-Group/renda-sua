export const ADMIN_OPERATIONAL_STATUSES = [
  'pending',
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'assigned_to_agent',
  'in_transit',
  'out_for_delivery',
] as const;

export const ADMIN_TERMINAL_STATUSES = [
  'cancelled',
  'complete',
  'delivered',
  'failed',
  'refunded',
  'refund_processing',
  'refund_failed',
  'refund_requested',
  'refund_approved_full',
  'refund_approved_partial',
  'refund_rejected',
  'refund_approved_replace',
] as const;

/** Statuses that skip capture, settlement, or refunds if written directly. */
export const ADMIN_SETTLEMENT_STATUSES = [
  'complete',
  'delivered',
  'picked_up',
  'failed',
  'refunded',
  'refund_processing',
  'refund_failed',
  'refund_requested',
  'refund_approved_full',
  'refund_approved_partial',
  'refund_rejected',
  'refund_approved_replace',
] as const;

export const ADMIN_STATUS_OVERRIDE_VALUES = [
  'cancelled',
  ...ADMIN_OPERATIONAL_STATUSES,
] as const;

/**
 * ALLOWLIST of pre-pickup statuses an admin may cancel. Everything else (picked_up,
 * in_transit, out_for_delivery, awaiting_shipment, shipped, in_delivery, delivered,
 * complete, the refund states, cancelled, failed, and any status added later) is
 * refused.
 * TODO(#626): #626 defines the same list as ADMIN_FULL_REFUND_ALLOWED_STATUSES in
 * orders.service.ts; once both are on main, make that one reuse this constant.
 */
export const ADMIN_PRE_PICKUP_CANCELLABLE_STATUSES = [
  'pending_payment',
  'pending',
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'assigned_to_agent',
] as const;

export function isAdminPrePickupCancellableStatus(status: string): boolean {
  return (ADMIN_PRE_PICKUP_CANCELLABLE_STATUSES as readonly string[]).includes(status);
}

export function isAdminTerminalStatus(status: string): boolean {
  return (ADMIN_TERMINAL_STATUSES as readonly string[]).includes(status);
}

export function isAdminOperationalStatus(status: string): boolean {
  return (ADMIN_OPERATIONAL_STATUSES as readonly string[]).includes(status);
}

export function isAdminSettlementStatus(status: string): boolean {
  return (ADMIN_SETTLEMENT_STATUSES as readonly string[]).includes(status);
}

/** Post-pickup statuses the override may still move between (agent en route). */
const ADMIN_OVERRIDE_POST_PICKUP_STATUSES: readonly string[] = ['in_transit', 'out_for_delivery'];

/**
 * #627 C1: the explicit allowed transitions for PATCH /admin/orders/:id/status (a
 * non-cancel override), checked against the CURRENT status:
 * - from a pre-pickup status (the cancel allowlist minus pending_payment, which only
 *   the payment flow may leave) to any operational status;
 * - from in_transit / out_for_delivery only to in_transit / out_for_delivery (never
 *   back to a pre-pickup status, which would let a cancel or full refund follow);
 * - from anything else (pending_payment, picked_up, shipping statuses, delivered,
 *   complete, refund states, cancelled, failed, or a status added later): nothing;
 * - a move to the same status is not a transition.
 */
export function isAdminOverrideTransitionAllowed(from: string, to: string): boolean {
  if (from === to || !isAdminOperationalStatus(to)) return false;
  if (from !== 'pending_payment' && isAdminPrePickupCancellableStatus(from)) return true;
  return (
    ADMIN_OVERRIDE_POST_PICKUP_STATUSES.includes(from) &&
    ADMIN_OVERRIDE_POST_PICKUP_STATUSES.includes(to)
  );
}
