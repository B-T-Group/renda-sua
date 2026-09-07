export const INCOMING_ORDER_EVENTS = [
  'order_created',
  'order_acceptance_activate',
  'order_acceptance_reminder',
  'order_acceptance_escalation',
  'order_acceptance_missed',
] as const;

export const OFFER_PUSH_TYPES = [
  'order_offer',
  'order_offer_cancelled',
] as const;
export const STOCK_CHECK_PUSH_TYPES = [
  'stock_availability_check',
] as const;

export type InterruptMatch =
  | { kind: 'order_offer'; orderId: string; cancelled: boolean }
  | { kind: 'incoming_order'; orderId: string; locationId?: string }
  | { kind: 'stock_availability_check'; messageId: string };

function trimId(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseLocationId(data: Record<string, unknown>): string | undefined {
  const raw = data.locationId ?? data.location_id ?? data.businessLocationId;
  const id = trimId(raw);
  return id || undefined;
}

function parseStockMessageId(data: Record<string, unknown>): string | null {
  const raw = trimId(data.messageId);
  if (raw) return raw;
  const url = typeof data.url === 'string' ? data.url : '';
  const m = url.match(/stock-availability\/([0-9a-f-]{36})/i);
  return m?.[1] ?? null;
}

function isOfferType(type: string): boolean {
  return (OFFER_PUSH_TYPES as readonly string[]).includes(type);
}

function isStockType(type: string): boolean {
  return (STOCK_CHECK_PUSH_TYPES as readonly string[]).includes(type);
}

function isIncomingEvent(event: string): boolean {
  return (INCOMING_ORDER_EVENTS as readonly string[]).includes(event);
}

/** Maps a push payload to an overlay interrupt, or null if another handler owns it. */
export function matchInterrupt(
  data: Record<string, unknown> | undefined
): InterruptMatch | null {
  if (!data) return null;

  const type = typeof data.type === 'string' ? data.type : '';
  const event = typeof data.event === 'string' ? data.event : '';
  const orderId = trimId(data.orderId);

  if (isOfferType(type)) {
    if (!orderId) return null;
    return {
      kind: 'order_offer',
      orderId,
      cancelled: type === 'order_offer_cancelled',
    };
  }

  if (isStockType(type)) {
    const messageId = parseStockMessageId(data);
    if (!messageId) return null;
    return { kind: 'stock_availability_check', messageId };
  }

  if (isIncomingEvent(event) && orderId) {
    return {
      kind: 'incoming_order',
      orderId,
      locationId: parseLocationId(data),
    };
  }

  return null;
}
