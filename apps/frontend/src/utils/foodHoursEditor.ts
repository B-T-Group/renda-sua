import type { ServiceHoursValue } from '../components/admin/ServiceHoursEditor';
import type { FoodAvailabilitySlot } from '../types/food';
import { formatSlotTime } from './foodAvailability';
import type { DayName } from './operatingHours';

const DAY_ORDER: DayName[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

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

function firstSlotForDay(
  slots: FoodAvailabilitySlot[],
  day: DayName
): FoodAvailabilitySlot | undefined {
  const index = DAY_TO_INDEX[day];
  return [...slots]
    .filter((slot) => slot.day_of_week === index)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))[0];
}

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

/** Maps food slots onto the location hours editor (one window per day). */
export function foodSlotsToEditorValue(
  slots: FoodAvailabilitySlot[]
): ServiceHoursValue {
  const value: ServiceHoursValue = {};
  for (const day of DAY_ORDER) {
    const slot = firstSlotForDay(slots, day);
    value[day] = slot
      ? {
          enabled: true,
          start: formatSlotTime(slot.start_time) || DEFAULT_OPEN,
          end: formatSlotTime(slot.end_time) || DEFAULT_CLOSE,
        }
      : { enabled: false, start: DEFAULT_OPEN, end: DEFAULT_CLOSE };
  }
  return value;
}

/** Maps the location hours editor back to food slots. All days off = always available. */
export function editorValueToFoodSlots(
  value: ServiceHoursValue
): FoodAvailabilitySlot[] {
  return DAY_ORDER.filter((day) => value[day]?.enabled).map((day) => ({
    day_of_week: DAY_TO_INDEX[day],
    start_time: formatSlotTime(value[day].start) || DEFAULT_OPEN,
    end_time: formatSlotTime(value[day].end) || DEFAULT_CLOSE,
  }));
}
