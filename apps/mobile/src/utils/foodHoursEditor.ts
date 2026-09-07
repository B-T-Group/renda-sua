import type { FoodAvailabilitySlot } from '../types/food';
import { formatSlotTime } from './foodAvailability';
import {
  DAY_ORDER,
  type DayName,
  type OperatingHoursEditorRow,
} from './operatingHours';

/** Sunday-first, matching food_availability_slots.day_of_week. */
const DAY_TO_INDEX: Record<DayName, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const DEFAULT_OPEN = '08:00';
const DEFAULT_CLOSE = '20:00';

/** True when any weekday has more than one serving window. */
export function foodSlotsHaveMultipleWindowsPerDay(
  slots: FoodAvailabilitySlot[]
): boolean {
  const counts = new Map<number, number>();
  for (const slot of slots) {
    const next = (counts.get(slot.day_of_week) ?? 0) + 1;
    if (next > 1) return true;
    counts.set(slot.day_of_week, next);
  }
  return false;
}

function firstSlotForDay(
  slots: FoodAvailabilitySlot[],
  day: DayName
): FoodAvailabilitySlot | undefined {
  const index = DAY_TO_INDEX[day];
  return [...slots]
    .filter((slot) => slot.day_of_week === index)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))[0];
}

/** Maps food slots onto the location hours editor (one window per day). */
export function foodSlotsToEditorRows(
  slots: FoodAvailabilitySlot[]
): OperatingHoursEditorRow[] {
  return DAY_ORDER.map((day) => {
    const slot = firstSlotForDay(slots, day);
    if (!slot) {
      return { day, enabled: false, open: DEFAULT_OPEN, close: DEFAULT_CLOSE };
    }
    return {
      day,
      enabled: true,
      open: formatSlotTime(slot.start_time) || DEFAULT_OPEN,
      close: formatSlotTime(slot.end_time) || DEFAULT_CLOSE,
    };
  });
}

/** Maps the location hours editor back to food slots. All days off = always available. */
export function editorRowsToFoodSlots(
  rows: OperatingHoursEditorRow[]
): FoodAvailabilitySlot[] {
  return rows
    .filter((row) => row.enabled)
    .map((row) => ({
      day_of_week: DAY_TO_INDEX[row.day],
      start_time: formatSlotTime(row.open) || DEFAULT_OPEN,
      end_time: formatSlotTime(row.close) || DEFAULT_CLOSE,
    }));
}
