import { DateTime } from 'luxon';
import {
  formatOperatingHoursForDisplay,
  getDayNameForIndex,
  normalizeOperatingHours,
  parseTimeToMinutes,
} from '../common/operating-hours.util';
import {
  formatFoodSlotsForDisplay,
  type FoodAvailabilitySlot,
} from './food-availability.util';
import { isCookedFoodItem } from './cooked-food-flag.util';

export interface CookedFoodStoreClosedHourSlot {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface CookedFoodStoreClosedDetails {
  timezone: string;
  next_opens_at: string | null;
  hours: CookedFoodStoreClosedHourSlot[];
}

function describeNextOpening(
  nextOpeningAt: string | null | undefined,
  timezone: string
): string {
  if (!nextOpeningAt) return '';
  const local = DateTime.fromISO(nextOpeningAt, { zone: timezone });
  if (!local.isValid) return '';
  return ` Next opening: ${local.toFormat('cccc')} at ${local.toFormat('HH:mm')}.`;
}

function formatHm(value: string | undefined | null): string | null {
  const mins = parseTimeToMinutes(value);
  if (mins == null) return null;
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function normalizeSlot(slot: FoodAvailabilitySlot): CookedFoodStoreClosedHourSlot | null {
  const start = formatHm(slot.start_time);
  const end = formatHm(slot.end_time);
  if (start == null || end == null) return null;
  const day = Number(slot.day_of_week);
  if (!Number.isFinite(day) || day < 0 || day > 6) return null;
  return { day_of_week: day, start_time: start, end_time: end };
}

function hoursFromFoodSlots(
  slots: FoodAvailabilitySlot[]
): CookedFoodStoreClosedHourSlot[] {
  const result: CookedFoodStoreClosedHourSlot[] = [];
  const seen = new Set<string>();
  for (const slot of slots) {
    const normalized = normalizeSlot(slot);
    if (!normalized) continue;
    const key = `${normalized.day_of_week}|${normalized.start_time}|${normalized.end_time}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result.sort(
    (a, b) =>
      a.day_of_week - b.day_of_week ||
      a.start_time.localeCompare(b.start_time)
  );
}

function hoursFromOperatingHours(
  raw: unknown
): CookedFoodStoreClosedHourSlot[] {
  const hours = normalizeOperatingHours(raw);
  if (!hours) return [];
  const result: CookedFoodStoreClosedHourSlot[] = [];
  for (let day = 0; day < 7; day++) {
    const dayHours = hours[getDayNameForIndex(day)];
    if (!dayHours || dayHours.closed) continue;
    const start = formatHm(dayHours.open);
    const end = formatHm(dayHours.close);
    if (!start || !end) continue;
    result.push({ day_of_week: day, start_time: start, end_time: end });
  }
  return result;
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
 * Structured closed-kitchen schedule for sticky UI (timezone, next open, hours).
 * Prefers food serving windows; falls back to store operating hours.
 */
export function buildCookedFoodStoreClosedDetails(params: {
  opensAt?: string | null;
  timezone: string;
  operatingHours?: unknown;
  foodSlots?: FoodAvailabilitySlot[];
}): CookedFoodStoreClosedDetails {
  const foodHours = hoursFromFoodSlots(params.foodSlots ?? []);
  return {
    timezone: params.timezone || 'UTC',
    next_opens_at: params.opensAt ?? null,
    hours:
      foodHours.length > 0
        ? foodHours
        : hoursFromOperatingHours(params.operatingHours),
  };
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
