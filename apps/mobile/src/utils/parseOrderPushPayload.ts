import type { PersonaSlug } from '../types/persona';
import { parsePersonaFromPushData } from './notificationPersona';

export interface ParsedOrderPushPayload {
  orderId: string;
  openMessages: boolean;
  highlightMessageId?: string;
  rate?: 'agent' | 'item';
  persona: PersonaSlug | null;
  /** Order location — used to switch into a matching location delegation. */
  locationId?: string;
}

function parseLocationId(data: Record<string, unknown>): string | undefined {
  const raw = data.locationId ?? data.location_id ?? data.businessLocationId;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  return undefined;
}

/**
 * Parses order deep-link payloads from push notification data.
 * Incoming-order acceptance events and agent pickup reminders return null
 * so their overlays own presentation — unless `locationId` is present (delegate fan-out).
 */
export function parseOrderPushPayload(
  data: Record<string, unknown> | undefined
): ParsedOrderPushPayload | null {
  if (!data) return null;
  // Delivery-offer, stock-availability, and merchant acceptance overlays own these.
  if (
    data.type === 'order_offer' ||
    data.type === 'order_offer_cancelled' ||
    data.type === 'stock_availability_check'
  ) {
    return null;
  }

  const locationId = parseLocationId(data);

  if (
    data.event === 'order_created' ||
    data.event === 'order_acceptance_activate' ||
    data.event === 'order_acceptance_reminder' ||
    data.event === 'order_acceptance_escalation' ||
    data.event === 'order_acceptance_missed'
  ) {
    // Delegate fan-out includes locationId; owner overlay owns the rest.
    if (!locationId) return null;
  }
  // Agent pickup-reminder overlay owns agent persona taps; business deep-links.
  if (data.event === 'pickup_reminder') {
    const persona = parsePersonaFromPushData(data);
    if (persona !== 'business' && !locationId) return null;
  }
  // Client store-pickup reminder overlay owns these taps.
  if (data.event === 'store_pickup_reminder') {
    return null;
  }
  const raw = data.orderId;
  let orderId: string | null = null;
  if (typeof raw === 'string' && raw.trim()) {
    orderId = raw.trim();
  } else {
    const url = data.url;
    if (typeof url === 'string') {
      const m = url.match(/\/orders\/([0-9a-f-]{36})/i);
      if (m?.[1]) orderId = m[1];
    }
  }
  if (!orderId) return null;

  const openMessages =
    data.type === 'order_message' ||
    data.type === 'order_message_mention' ||
    data.type === 'order_delivery_pin_shared';

  const highlightRaw = data.messageId ?? data.highlightMessageId;
  const highlightMessageId =
    typeof highlightRaw === 'string' && highlightRaw.trim()
      ? highlightRaw.trim()
      : undefined;

  const rate =
    data.type === 'rate_agent'
      ? 'agent'
      : data.type === 'rate_item'
        ? 'item'
        : undefined;

  return {
    orderId,
    openMessages,
    highlightMessageId,
    rate,
    persona: parsePersonaFromPushData(data),
    locationId,
  };
}
