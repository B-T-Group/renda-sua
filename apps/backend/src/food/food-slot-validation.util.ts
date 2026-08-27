import { parseTimeToMinutes } from '../common/operating-hours.util';
import type { FoodAvailabilitySlot } from './food-availability.util';

const MINUTES_PER_DAY = 24 * 60;

interface AbsoluteWindow {
  start: number;
  end: number;
}

/**
 * Expands a weekly window onto a two-week minute timeline so windows running
 * past midnight can be compared against the next day, including the Saturday
 * to Sunday wrap.
 */
function toAbsoluteWindows(slot: FoodAvailabilitySlot): AbsoluteWindow[] {
  const start = parseTimeToMinutes(slot.start_time) ?? 0;
  const end = parseTimeToMinutes(slot.end_time) ?? 0;
  const dayStart = slot.day_of_week * MINUTES_PER_DAY;
  const absoluteStart = dayStart + start;
  const absoluteEnd = dayStart + (end > start ? end : MINUTES_PER_DAY + end);
  const weekMinutes = 7 * MINUTES_PER_DAY;
  return [
    { start: absoluteStart, end: absoluteEnd },
    { start: absoluteStart + weekMinutes, end: absoluteEnd + weekMinutes },
  ];
}

function overlaps(a: AbsoluteWindow, b: AbsoluteWindow): boolean {
  return a.start < b.end && b.start < a.end;
}

export function findZeroLengthSlot(
  slots: FoodAvailabilitySlot[]
): FoodAvailabilitySlot | null {
  return (
    slots.find(
      (slot) =>
        parseTimeToMinutes(slot.start_time) ===
        parseTimeToMinutes(slot.end_time)
    ) ?? null
  );
}

/** Returns the first pair of windows that overlap, or null when the week is clean. */
export function findOverlappingSlots(
  slots: FoodAvailabilitySlot[]
): [FoodAvailabilitySlot, FoodAvailabilitySlot] | null {
  for (let i = 0; i < slots.length; i += 1) {
    for (let j = i + 1; j < slots.length; j += 1) {
      const first = toAbsoluteWindows(slots[i]);
      const second = toAbsoluteWindows(slots[j]);
      const collides = first.some((a) => second.some((b) => overlaps(a, b)));
      if (collides) return [slots[i], slots[j]];
    }
  }
  return null;
}
