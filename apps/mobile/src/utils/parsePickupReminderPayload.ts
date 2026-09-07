import type { PickupReminderPayload } from '../types/pickupReminder';

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function parsePickupReminderPayload(
  data: Record<string, unknown> | null | undefined
): Omit<PickupReminderPayload, 'title' | 'body'> | null {
  if (!data) return null;
  if (asString(data.event) !== 'pickup_reminder') return null;
  const orderId = asString(data.orderId);
  if (!orderId) return null;
  return {
    orderId,
    orderNumber: asString(data.orderNumber),
    businessName: asString(data.businessName),
    pickupDueAt: asString(data.pickupDueAt),
  };
}

export function parsePickupReminderFromNotification(content: {
  title?: unknown;
  body?: unknown;
  data?: Record<string, unknown>;
}): PickupReminderPayload | null {
  const fromData = parsePickupReminderPayload(content.data);
  if (!fromData) return null;
  const title = asString(content.title);
  const body = asString(content.body);
  if (!title || !body) return null;
  return { ...fromData, title, body };
}
