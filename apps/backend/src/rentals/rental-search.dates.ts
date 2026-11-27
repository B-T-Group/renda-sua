import {
  nextFreeStartMs,
  unitsStillFree,
  weekdaysOpen,
  type CapacityWindow,
  type WeeklyAvailability,
} from './rental-capacity';

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const CLOCK = /^(\d{2}):(\d{2})$/;
const DAY_MS = 86_400_000;

export interface SearchDateRange {
  startDate: string;
  endDate: string;
  startMs: number;
  endMs: number;
  dayCount: number;
  startTime?: string;
  endTime?: string;
}

/**
 * `endDate` is exclusive. Optional clock times narrow the first and last day, as listing
 * wall-clock written as UTC (the same convention as booking windows). Without times the
 * range is whole days.
 */
export function parseSearchDateRange(
  startDate?: string,
  endDate?: string,
  startTime?: string,
  endTime?: string
): SearchDateRange | null {
  if (!startDate && !endDate) return null;
  if (!startDate || !endDate) throw new Error('INVALID_DATE_RANGE');
  const startDay = utcDayMs(startDate);
  const endDay = utcDayMs(endDate);
  if (startDay == null || endDay == null || endDay <= startDay) {
    throw new Error('INVALID_DATE_RANGE');
  }
  const dayCount = Math.round((endDay - startDay) / DAY_MS);
  if (dayCount < 1 || dayCount > 30) throw new Error('INVALID_DATE_RANGE');
  const startMs = startDay + clockMs(startTime, 0);
  const endMs = endDay - DAY_MS + clockMs(endTime, DAY_MS);
  if (endMs <= startMs || clockMs(startTime, 0) >= DAY_MS) throw new Error('INVALID_DATE_RANGE');
  return {
    startDate,
    endDate,
    startMs,
    endMs,
    dayCount,
    ...(startTime ? { startTime } : {}),
    ...(endTime ? { endTime } : {}),
  };
}

function clockMs(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const match = CLOCK.exec(value);
  if (!match) throw new Error('INVALID_DATE_RANGE');
  return (Number(match[1]) * 60 + Number(match[2])) * 60_000;
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
  const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  // Date.UTC rolls 2026-13-01 or 2026-02-31 over to a real day; reject anything that is not that calendar day.
  return new Date(ms).toISOString().slice(0, 10) === value ? ms : null;
}
