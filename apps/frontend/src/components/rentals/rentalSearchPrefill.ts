import type { SelectionRange } from './rentalRequestScheduleUtils';

const MAX_DAYS = 30;

function exclusiveDays(start: string, end: string): string[] {
  const days: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor < last && days.length < MAX_DAYS) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function at(day: string, clock: string): number {
  return Date.parse(`${day}T${clock === '24:00' ? '23:59' : clock}:00`);
}

export interface SearchPrefill {
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  /** Partial first and last days are hourly only when the listing has an hourly price. */
  hourly: boolean;
}

/**
 * One window per day of a browse search. A start time opens the first day there and an
 * end time closes the last day there; other days keep the default business hours.
 */
export function searchPrefillRanges(input: SearchPrefill): SelectionRange[] {
  const days = exclusiveDays(input.startDate, input.endDate);
  return days.flatMap((day, index) => {
    const startClock = index === 0 ? input.startTime : undefined;
    const endClock = index === days.length - 1 ? input.endTime : undefined;
    const partial = input.hourly && Boolean(startClock || endClock);
    const startMs = partial && startClock ? at(day, startClock) : Date.parse(`${day}T08:00:00`);
    const endMs = partial && endClock ? at(day, endClock) : Date.parse(`${day}T18:00:00`);
    if (!(endMs > startMs)) return [];
    return [
      {
        id: `prefill-${day}`,
        startMs,
        endMs,
        billing: partial ? ('hourly' as const) : ('all_day' as const),
        ...(partial ? {} : { calendarDate: day }),
      },
    ];
  });
}
