import type {
  IncomingOrderDeliveryWindow,
  IncomingOrderDetails,
} from '../types/incomingOrder';

type SlotParts = { year: number; month: number; day: number };

function parseYmd(ymd: string): SlotParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function parseHourMinute(
  time: string | undefined
): { hour: number; minute: number } | null {
  if (!time?.trim()) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

function slotEndLocal(window: IncomingOrderDeliveryWindow): Date | null {
  if (!window.preferred_date) return null;
  const parts = parseYmd(window.preferred_date);
  if (!parts) return null;
  const time =
    parseHourMinute(window.time_slot_end) ??
    parseHourMinute(window.time_slot_start);
  if (time) {
    return new Date(
      parts.year,
      parts.month - 1,
      parts.day,
      time.hour,
      time.minute,
      0,
      0
    );
  }
  return new Date(parts.year, parts.month - 1, parts.day, 23, 59, 59, 999);
}

export function deliverySlotEnd(
  details: IncomingOrderDetails | null | undefined
): Date | null {
  const window = details?.delivery_time_windows?.[0];
  if (!window?.preferred_date) return null;
  return slotEndLocal(window);
}

/** True when a scheduled delivery window has already ended (local time). */
export function isDeliverySlotPast(
  details: IncomingOrderDetails | null | undefined,
  now: Date = new Date()
): boolean {
  const end = deliverySlotEnd(details);
  if (!end) return false;
  return now.getTime() > end.getTime();
}

const ACTIONABLE_SLOT_STATES = new Set(['active', 'busy', 'confirming']);

/** Past-slot lock only after this order has loaded into an actionable state. */
export function isActionableDeliverySlotPast(
  details: IncomingOrderDetails | null | undefined,
  uiState: string,
  now: Date = new Date()
): boolean {
  if (!ACTIONABLE_SLOT_STATES.has(uiState)) return false;
  return isDeliverySlotPast(details, now);
}
