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

/**
 * Whether a sold-out stamp still applies today, judged against the viewer's
 * own calendar day. Intended for merchant screens, where the person managing
 * the kitchen is in the restaurant's timezone. Shopper-facing screens use the
 * flag the backend computes from the location's timezone instead.
 */
export function isMarkedUnavailableToday(
  markedUnavailableAt?: string | null
): boolean {
  if (!markedUnavailableAt) return false;
  const marked = new Date(markedUnavailableAt);
  if (Number.isNaN(marked.getTime())) return false;
  const now = new Date();
  return (
    marked.getFullYear() === now.getFullYear() &&
    marked.getMonth() === now.getMonth() &&
    marked.getDate() === now.getDate()
  );
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
