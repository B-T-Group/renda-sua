import { DateTime } from 'luxon';
import { parseTimeToMinutes } from '../common/operating-hours.util';

const MINUTES_PER_DAY = 24 * 60;
const DAYS_TO_SCAN_FOR_NEXT_OPENING = 8;

export interface FoodAvailabilitySlot {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface FoodAvailabilityInput {
  slots: FoodAvailabilitySlot[];
  markedUnavailableAt?: string | Date | null;
  now: Date;
  timezone: string;
}

export interface FoodAvailability {
  /** No slots configured means the dish is on the menu at all times. */
  hasSchedule: boolean;
  isOpenNow: boolean;
  isMarkedUnavailableToday: boolean;
  isAvailableNow: boolean;
  nextOpeningAt: Date | null;
}

interface ResolvedSlot {
  dayOfWeek: number;
  startMinutes: number;
  endMinutes: number;
  /** End earlier than start means the window runs past midnight. */
  isOvernight: boolean;
}

/** Luxon weekdays run Mon=1..Sun=7; slots use the JS convention Sun=0..Sat=6. */
function toSlotWeekday(local: DateTime): number {
  return local.weekday === 7 ? 0 : local.weekday;
}

function resolveSlot(slot: FoodAvailabilitySlot): ResolvedSlot | null {
  const startMinutes = parseTimeToMinutes(slot.start_time);
  const endMinutes = parseTimeToMinutes(slot.end_time);
  if (startMinutes == null || endMinutes == null) return null;
  if (startMinutes === endMinutes) return null;
  if (slot.day_of_week < 0 || slot.day_of_week > 6) return null;
  return {
    dayOfWeek: slot.day_of_week,
    startMinutes,
    endMinutes,
    isOvernight: endMinutes < startMinutes,
  };
}

function resolveSlots(slots: FoodAvailabilitySlot[]): ResolvedSlot[] {
  return slots
    .map(resolveSlot)
    .filter((slot): slot is ResolvedSlot => slot !== null);
}

/** Is `local` inside a window that started earlier on the same day? */
function isWithinSameDayPortion(slot: ResolvedSlot, local: DateTime): boolean {
  const minutes = local.hour * 60 + local.minute;
  if (toSlotWeekday(local) !== slot.dayOfWeek) return false;
  if (minutes < slot.startMinutes) return false;
  return slot.isOvernight ? true : minutes < slot.endMinutes;
}

/** Is `local` inside the after-midnight tail of a window that started yesterday? */
function isWithinOvernightTail(slot: ResolvedSlot, local: DateTime): boolean {
  if (!slot.isOvernight) return false;
  const minutes = local.hour * 60 + local.minute;
  const yesterday = local.minus({ days: 1 });
  if (toSlotWeekday(yesterday) !== slot.dayOfWeek) return false;
  return minutes < slot.endMinutes;
}

function isOpenAt(slots: ResolvedSlot[], local: DateTime): boolean {
  return slots.some(
    (slot) =>
      isWithinSameDayPortion(slot, local) || isWithinOvernightTail(slot, local)
  );
}

/**
 * Start of the current service day. A window running past midnight belongs to
 * the day it started on, so a dish marked sold out at 23:00 stays sold out
 * until that window closes rather than reappearing at midnight.
 */
function serviceDayStart(slots: ResolvedSlot[], local: DateTime): DateTime {
  const carriedOver = slots.some((slot) => isWithinOvernightTail(slot, local));
  const day = carriedOver ? local.minus({ days: 1 }) : local;
  return day.startOf('day');
}

function parseMarkedAt(
  markedUnavailableAt: string | Date,
  zone: DateTime['zone']
): DateTime | null {
  const marked =
    markedUnavailableAt instanceof Date
      ? DateTime.fromJSDate(markedUnavailableAt, { zone })
      : DateTime.fromISO(markedUnavailableAt, { zone });
  return marked.isValid ? marked : null;
}

function isMarkedUnavailableForServiceDay(
  markedUnavailableAt: string | Date | null | undefined,
  slots: ResolvedSlot[],
  local: DateTime
): boolean {
  if (!markedUnavailableAt) return false;
  const marked = parseMarkedAt(markedUnavailableAt, local.zone);
  if (!marked) return false;
  // Compare service days, not calendar instants. A stamp at 01:30 during an
  // overnight tail belongs to yesterday's service day and must not block
  // later windows on the new calendar day (lunch or the next evening).
  return (
    serviceDayStart(slots, marked).toMillis() ===
    serviceDayStart(slots, local).toMillis()
  );
}

function nextOpeningFrom(slots: ResolvedSlot[], local: DateTime): Date | null {
  for (let offset = 0; offset < DAYS_TO_SCAN_FOR_NEXT_OPENING; offset += 1) {
    const day = local.plus({ days: offset });
    const candidates = slots
      .filter((slot) => slot.dayOfWeek === toSlotWeekday(day))
      .map((slot) => day.startOf('day').plus({ minutes: slot.startMinutes }))
      .filter((start) => start > local)
      .sort((a, b) => a.toMillis() - b.toMillis());
    if (candidates.length > 0) return candidates[0].toUTC().toJSDate();
  }
  return null;
}

/**
 * Resolves whether a dish can be ordered right now. A dish is orderable when a
 * window is open and the merchant has not marked it sold out for the day.
 */
export function resolveFoodAvailability(
  input: FoodAvailabilityInput
): FoodAvailability {
  const local = DateTime.fromJSDate(input.now, { zone: input.timezone });
  const slots = resolveSlots(input.slots ?? []);
  const hasSchedule = slots.length > 0;
  const isOpenNow = hasSchedule ? isOpenAt(slots, local) : true;
  const isMarkedUnavailableToday = isMarkedUnavailableForServiceDay(
    input.markedUnavailableAt,
    slots,
    local
  );
  return {
    hasSchedule,
    isOpenNow,
    isMarkedUnavailableToday,
    isAvailableNow: isOpenNow && !isMarkedUnavailableToday,
    nextOpeningAt: hasSchedule ? nextOpeningFrom(slots, local) : null,
  };
}

/** Minutes remaining before the currently open window closes. */
export function minutesUntilFoodWindowCloses(
  input: FoodAvailabilityInput
): number | null {
  const local = DateTime.fromJSDate(input.now, { zone: input.timezone });
  const slots = resolveSlots(input.slots ?? []);
  if (slots.length === 0) return null;
  const minutes = local.hour * 60 + local.minute;
  const remaining = slots
    .filter(
      (slot) =>
        isWithinSameDayPortion(slot, local) || isWithinOvernightTail(slot, local)
    )
    .map((slot) =>
      slot.endMinutes > minutes
        ? slot.endMinutes - minutes
        : MINUTES_PER_DAY - minutes + slot.endMinutes
    );
  return remaining.length > 0 ? Math.max(...remaining) : null;
}
