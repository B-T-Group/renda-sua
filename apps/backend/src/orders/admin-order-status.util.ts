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

export function isAdminTerminalStatus(status: string): boolean {
  return (ADMIN_TERMINAL_STATUSES as readonly string[]).includes(status);
}

export function isAdminOperationalStatus(status: string): boolean {
  return (ADMIN_OPERATIONAL_STATUSES as readonly string[]).includes(status);
}

export function isAdminSettlementStatus(status: string): boolean {
  return (ADMIN_SETTLEMENT_STATUSES as readonly string[]).includes(status);
}
