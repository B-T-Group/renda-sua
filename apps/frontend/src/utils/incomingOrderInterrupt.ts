export const INCOMING_INTERRUPT_EVENTS = new Set([
  'order_created',
  'order_acceptance_activate',
  'order_acceptance_reminder',
]);

const ACTIONABLE_STATES = new Set([
  'awaiting_acceptance',
  'no_response',
  'grace',
]);

export type IncomingInterruptOrder = {
  current_status?: string | null;
  acceptance_state?: string | null;
  grace_deadline_at?: string | null;
  acceptance_deadline_at?: string | null;
};

export function isActionableIncomingOrder(
  order: IncomingInterruptOrder | null | undefined
): boolean {
  if (!order || order.current_status !== 'pending') return false;
  const state = order.acceptance_state ?? 'awaiting_acceptance';
  return ACTIONABLE_STATES.has(state);
}

export function resolveIncomingInterruptDeadline(
  order: IncomingInterruptOrder | null | undefined
): string | null {
  return order?.grace_deadline_at ?? order?.acceptance_deadline_at ?? null;
}

export function incomingInterruptSecondsLeft(
  deadline: string | null,
  nowMs: number
): number | null {
  if (!deadline) return null;
  const diff = Date.parse(deadline) - nowMs;
  if (Number.isNaN(diff)) return null;
  return Math.max(0, Math.ceil(diff / 1000));
}

export function readIncomingInterruptPayload(event: {
  data?: unknown;
}): { eventName: string | null; orderId: string | null } {
  const data = (event.data ?? {}) as Record<string, unknown>;
  const nested =
    data.data && typeof data.data === 'object'
      ? (data.data as Record<string, unknown>)
      : {};
  return {
    eventName: stringOrNull(data.event) ?? stringOrNull(nested.event),
    orderId: stringOrNull(data.orderId) ?? stringOrNull(nested.orderId),
  };
}

export function shouldOpenIncomingInterrupt(eventName: string | null): boolean {
  return !!eventName && INCOMING_INTERRUPT_EVENTS.has(eventName);
}

export function nextIncomingOrderId(
  queue: Array<{ id: string }>,
  isSnoozed: (id: string) => boolean
): string | null {
  return queue.find((row) => row.id && !isSnoozed(row.id))?.id ?? null;
}

export function incomingWaitingCount(
  queue: Array<{ id: string }>,
  shownId: string | null,
  isSnoozed: (id: string) => boolean
): number {
  if (!shownId) return 0;
  const open = queue.filter((row) => row.id && !isSnoozed(row.id));
  const index = open.findIndex((row) => row.id === shownId);
  if (index < 0) return open.length;
  return Math.max(0, open.length - index - 1);
}

export function shouldKeepVisibleIncomingOrder(
  queue: Array<{ id: string }>,
  shownId: string | null
): boolean {
  return !!shownId && queue.some((row) => row.id === shownId);
}

export function pendingAcceptanceQueue(payload: {
  queue?: Array<{ id: string }> | null;
  order?: { id: string } | null;
}): Array<{ id: string }> {
  if (payload.queue?.length) return payload.queue.filter((row) => !!row.id);
  return payload.order?.id ? [{ id: payload.order.id }] : [];
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}
