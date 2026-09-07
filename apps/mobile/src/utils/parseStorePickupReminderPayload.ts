import type { StorePickupReminderPayload } from '../types/storePickupReminder';

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function parseStorePickupReminderPayload(
  data: Record<string, unknown> | null | undefined
): Omit<StorePickupReminderPayload, 'title' | 'body'> | null {
  if (!data) return null;
  if (asString(data.event) !== 'store_pickup_reminder') return null;
  const orderId = asString(data.orderId);
  if (!orderId) return null;
  return {
    orderId,
    orderNumber: asString(data.orderNumber),
  };
}

export function parseStorePickupReminderFromNotification(content: {
  title?: unknown;
  body?: unknown;
  data?: Record<string, unknown>;
}): StorePickupReminderPayload | null {
  const fromData = parseStorePickupReminderPayload(content.data);
  if (!fromData) return null;
  const title = asString(content.title);
  const body = asString(content.body);
  if (!title || !body) return null;
  return { ...fromData, title, body };
}
