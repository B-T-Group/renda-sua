import {
  nextFreeStartMs,
  unitsStillFree,
  weekdaysOpen,
  type CapacityWindow,
  type WeeklyAvailability,
} from './rental-capacity';

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

export interface SearchDateRange {
  startDate: string;
  endDate: string;
  startMs: number;
  endMs: number;
  dayCount: number;
}

export function parseSearchDateRange(
  startDate?: string,
  endDate?: string
): SearchDateRange | null {
  if (!startDate && !endDate) return null;
  if (!startDate || !endDate) throw new Error('INVALID_DATE_RANGE');
  const startMs = utcDayMs(startDate);
  const endMs = utcDayMs(endDate);
  if (startMs == null || endMs == null || endMs <= startMs) {
    throw new Error('INVALID_DATE_RANGE');
  }
  const dayCount = Math.round((endMs - startMs) / DAY_MS);
  if (dayCount < 1 || dayCount > 30) throw new Error('INVALID_DATE_RANGE');
  return {
    startDate,
    endDate,
    startMs,
    endMs,
    dayCount,
  };
}

export function totalForDates(pricePerDay: number, dayCount: number): number {
  const rate = Number(pricePerDay) || 0;
  return Number((rate * dayCount).toFixed(2));
}

export function availabilityForListing(input: {
  unitsAvailable: number;
  windows: CapacityWindow[];
  weekly?: WeeklyAvailability[] | null;
  range: SearchDateRange;
  nowMs: number;
  pricePerDay: number;
}): {
  available: boolean;
  nextAvailableDate: string | null;
  totalForDates: number | null;
} {
  const open = weekdaysOpen(input.weekly, input.range.startMs, input.range.endMs);
  const free =
    open &&
    unitsStillFree(
      input.unitsAvailable,
      input.windows,
      input.range.startMs,
      input.range.endMs
    );
  if (free) {
    return {
      available: true,
      nextAvailableDate: null,
      totalForDates: totalForDates(input.pricePerDay, input.range.dayCount),
    };
  }
  const next = nextFreeStartMs({
    unitsAvailable: input.unitsAvailable,
    windows: input.windows,
    weekly: input.weekly,
    startMs: input.range.startMs,
    endMs: input.range.endMs,
    nowMs: input.nowMs,
  });
  return {
    available: false,
    nextAvailableDate: next == null ? null : new Date(next).toISOString().slice(0, 10),
    totalForDates: null,
  };
}

function utcDayMs(value?: string): number | null {
  if (!value) return null;
  const match = DATE.exec(value);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}
