import { HttpException, HttpStatus } from '@nestjs/common';
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
 * refused — except a #626 full-refund cancel that already wrote cancellation
 * metadata, which may resume the order.cancelled enqueue (holds / wallet refund).
 * Shared by the PATCH cancel, cancelOrderAsAdmin and the #626 full-refund cancel.
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

/** Stored on `orders.cancellation_notes` by the #626 full-refund cancel. */
export const ADMIN_FULL_REFUND_NOTES_PREFIX = 'Admin full refund:';

export function adminFullRefundNotes(reason: string): string {
  return `${ADMIN_FULL_REFUND_NOTES_PREFIX} ${reason}`;
}

/**
 * A cancelled order that this endpoint already processed: retry may re-enqueue
 * `order.cancelled` (Lambda keys are per-order) without a second status CAS.
 */
export function isResumableAdminFullRefundCancel(order: {
  current_status?: string | null;
  cancelled_by?: string | null;
  cancellation_notes?: string | null;
}): boolean {
  const notes = order.cancellation_notes;
  return (
    order.current_status === 'cancelled' &&
    order.cancelled_by === 'system' &&
    typeof notes === 'string' &&
    notes.startsWith(ADMIN_FULL_REFUND_NOTES_PREFIX)
  );
}

export const ORDER_ALREADY_PICKED_UP = 'ORDER_ALREADY_PICKED_UP';

/**
 * PE (#626/#627): the one refusal for an admin cancel outside the pre-pickup allowlist,
 * on every cancel path: 409 with error ORDER_ALREADY_PICKED_UP.
 */
export function adminPrePickupRefusal(status: string, hint = 'Use the return / refund flow.'): HttpException {
  return new HttpException(
    {
      message: `Cannot cancel an order in ${status} status: only pre-pickup orders can be cancelled here. ${hint}`,
      error: ORDER_ALREADY_PICKED_UP,
    },
    HttpStatus.CONFLICT
  );
}

export function assertAdminPrePickupCancellable(status: string): void {
  if (!isAdminPrePickupCancellableStatus(status)) throw adminPrePickupRefusal(status);
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
 * - a move to the same status is not a transition;
 * - in_transit / out_for_delivery only when an agent is assigned (I1).
 */
export function isAdminOverrideTransitionAllowed(
  from: string,
  to: string,
  hasAssignedAgent = false
): boolean {
  if (from === to || !isAdminOperationalStatus(to)) return false;
  // #627 I1: en route needs an agent; no jump to in_transit/out_for_delivery without one.
  if (ADMIN_OVERRIDE_POST_PICKUP_STATUSES.includes(to) && !hasAssignedAgent) return false;
  if (from !== 'pending_payment' && isAdminPrePickupCancellableStatus(from)) return true;
  return (
    ADMIN_OVERRIDE_POST_PICKUP_STATUSES.includes(from) &&
    ADMIN_OVERRIDE_POST_PICKUP_STATUSES.includes(to)
  );
}
