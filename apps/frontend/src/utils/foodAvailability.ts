import type { FoodAvailability, FoodAvailabilitySlot } from '../types/food';

export type FoodAvailabilityStatus = 'available' | 'sold_out' | 'closed';

/** Null when the row is not cooked food, so callers can skip food UI entirely. */
export function resolveFoodAvailabilityStatus(
  availability?: FoodAvailability | null
): FoodAvailabilityStatus | null {
  if (!availability) return null;
  if (availability.is_marked_unavailable_today) return 'sold_out';
  if (!availability.is_open_now) return 'closed';
  return 'available';
}

function parseSlotMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec((time ?? '').trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** After-midnight tail of a window that started yesterday (end < start). */
function isWithinOvernightTail(
  slot: FoodAvailabilitySlot,
  now: Date
): boolean {
  const startMinutes = parseSlotMinutes(slot.start_time);
  const endMinutes = parseSlotMinutes(slot.end_time);
  if (startMinutes == null || endMinutes == null) return false;
  if (endMinutes >= startMinutes) return false;
  const yesterday = (now.getDay() + 6) % 7;
  if (slot.day_of_week !== yesterday) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes < endMinutes;
}

/**
 * Whether a sold-out stamp still applies for the current service day.
 * Overnight windows keep Friday's stamp active after midnight until that
 * window closes. Intended for merchant screens in the restaurant timezone;
 * shopper-facing screens use the flag the backend computes instead.
 */
export function isMarkedUnavailableToday(
  markedUnavailableAt?: string | null,
  slots: FoodAvailabilitySlot[] = [],
  now: Date = new Date()
): boolean {
  if (!markedUnavailableAt) return false;
  const marked = new Date(markedUnavailableAt);
  if (Number.isNaN(marked.getTime())) return false;
  const serviceDay = new Date(now);
  if ((slots ?? []).some((slot) => isWithinOvernightTail(slot, now))) {
    serviceDay.setDate(serviceDay.getDate() - 1);
  }
  serviceDay.setHours(0, 0, 0, 0);
  return marked.getTime() >= serviceDay.getTime();
}

/** Trims the seconds Postgres `time` columns carry, so 12:30:00 reads as 12:30. */
export function formatSlotTime(time: string): string {
  const match = /^(\d{1,2}):(\d{2})/.exec((time ?? '').trim());
  if (!match) return time ?? '';
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

export function sortFoodSlots(
  slots: FoodAvailabilitySlot[]
): FoodAvailabilitySlot[] {
  return [...(slots ?? [])].sort(
    (a, b) =>
      a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time)
  );
}

export function groupFoodSlotsByDay(
  slots: FoodAvailabilitySlot[]
): Map<number, FoodAvailabilitySlot[]> {
  const byDay = new Map<number, FoodAvailabilitySlot[]>();
  for (const slot of sortFoodSlots(slots)) {
    const existing = byDay.get(slot.day_of_week);
    if (existing) existing.push(slot);
    else byDay.set(slot.day_of_week, [slot]);
  }
  return byDay;
}

/** A window whose end is not after its start runs into the next day. */
export function isOvernightSlot(slot: FoodAvailabilitySlot): boolean {
  return formatSlotTime(slot.end_time) <= formatSlotTime(slot.start_time);
}

export function formatSlotRange(slot: FoodAvailabilitySlot): string {
  return `${formatSlotTime(slot.start_time)} - ${formatSlotTime(slot.end_time)}`;
}

/**
 * Weekday plus time of the next serving window, rendered in the restaurant's
 * timezone so a traveller sees the kitchen's clock rather than their own.
 */
export function formatNextOpening(
  nextOpeningAt: string | null | undefined,
  timezone: string | undefined,
  locale: string
): string | null {
  if (!nextOpeningAt) return null;
  const date = new Date(nextOpeningAt);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone || undefined,
    }).format(date);
  } catch {
    return null;
  }
}
