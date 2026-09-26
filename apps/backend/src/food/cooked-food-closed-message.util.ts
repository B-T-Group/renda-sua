import { DateTime } from 'luxon';
import { formatOperatingHoursForDisplay } from '../common/operating-hours.util';
import {
  formatFoodSlotsForDisplay,
  type FoodAvailabilitySlot,
} from './food-availability.util';
import { isCookedFoodItem } from './cooked-food-flag.util';

function describeNextOpening(
  nextOpeningAt: string | null | undefined,
  timezone: string
): string {
  if (!nextOpeningAt) return '';
  const local = DateTime.fromISO(nextOpeningAt, { zone: timezone });
  if (!local.isValid) return '';
  return ` Next opening: ${local.toFormat('cccc')} at ${local.toFormat('HH:mm')}.`;
}

/** Unique serving windows from cooked-food lines in a preflight inventory group. */
export function collectCookedFoodSlots(
  inventoryRows: Array<{
    item?: { is_cooked_food?: boolean | null } | null;
    food_settings?: Array<{
      availability_slots?: FoodAvailabilitySlot[] | null;
    }> | null;
  }>
): FoodAvailabilitySlot[] {
  const seen = new Set<string>();
  const slots: FoodAvailabilitySlot[] = [];
  for (const row of inventoryRows) {
    if (!isCookedFoodItem(row.item)) continue;
    for (const slot of row.food_settings?.[0]?.availability_slots ?? []) {
      const key = `${slot.day_of_week}|${slot.start_time}|${slot.end_time}`;
      if (seen.has(key)) continue;
      seen.add(key);
      slots.push(slot);
    }
  }
  return slots;
}

/**
 * Closed-kitchen copy for cooked-food ASAP checkout. Includes weekly hours
 * (food serving windows preferred over store hours) and the next opening.
 */
export function buildCookedFoodStoreClosedMessage(params: {
  opensAt?: string | null;
  timezone: string;
  operatingHours?: unknown;
  foodSlots?: FoodAvailabilitySlot[];
}): string {
  const schedule =
    formatFoodSlotsForDisplay(params.foodSlots ?? []) ||
    formatOperatingHoursForDisplay(params.operatingHours);
  const next = describeNextOpening(params.opensAt, params.timezone);

  let message = 'This kitchen is closed right now.';
  if (schedule) message += ` Available: ${schedule}.`;
  if (next) message += next;
  else if (!schedule) message += ' Try again when the store is open.';
  return message;
}
