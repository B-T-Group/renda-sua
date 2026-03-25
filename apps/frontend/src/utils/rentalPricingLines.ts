import type { WeeklyRow } from '../components/rentals/rentalRequestScheduleUtils';
import { rentalBillableHours } from '../components/rentals/rentalRequestScheduleUtils';

const ONE_HOUR_MS = 60 * 60 * 1000;

export function rentalHoursCount(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(ms / ONE_HOUR_MS));
}

export type RentalPricingLine =
  | {
      kind: 'hourly';
      startAt: string;
      endAt: string;
      billableHours: number;
      ratePerHour: number;
      subtotal: number;
    }
  | {
      kind: 'all_day';
      calendarDate: string;
      ratePerDay: number;
      subtotal: number;
    };

export function assertAllDayWindowMatchesListingOpenHours(
  weekly: WeeklyRow[],
  calendarDate: string,
  start: Date,
  end: Date
): void {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(calendarDate);
  if (!m) {
    throw new Error('Invalid calendar_date');
  }
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const anchor = new Date(Date.UTC(y, mo, d, 12, 0, 0, 0));
  const day = anchor.getUTCDay();
  const row = weekly.find((r) => r.weekday === day);
  if (!row?.is_available || !row.start_time || !row.end_time) {
    throw new Error('all_day is not valid on this calendar date');
  }
  const dayStart = new Date(Date.UTC(y, mo, d, 0, 0, 0, 0));
  const [sh, sm] = row.start_time.split(':').map(Number);
  const [eh, em] = row.end_time.split(':').map(Number);
  const windowStart = new Date(dayStart);
  windowStart.setUTCHours(sh, sm || 0, 0, 0);
  const windowEnd = new Date(dayStart);
  windowEnd.setUTCHours(eh, em || 0, 0, 0);
  if (start.getTime() !== windowStart.getTime() || end.getTime() !== windowEnd.getTime()) {
    throw new Error('all_day window must span full listing open hours for that date');
  }
}

export type ParsedRentalWindow = {
  start: Date;
  end: Date;
  billing: 'hourly' | 'all_day';
  calendarDate?: string;
};

export function parseRentalSelectionWindowsFromJson(
  raw: unknown,
  fallbackStart: string,
  fallbackEnd: string
): ParsedRentalWindow[] {
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((w: Record<string, unknown>) => {
      const billing = w.billing === 'all_day' ? 'all_day' : 'hourly';
      const calendarDate =
        typeof w.calendar_date === 'string' ? w.calendar_date : undefined;
      return {
        start: new Date(String(w.start_at)),
        end: new Date(String(w.end_at)),
        billing,
        calendarDate,
      };
    });
  }
  return [
    {
      start: new Date(fallbackStart),
      end: new Date(fallbackEnd),
      billing: 'hourly',
    },
  ];
}

export function computeRentalPricingLines(
  windows: ParsedRentalWindow[],
  weekly: WeeklyRow[],
  ratePerHour: number,
  ratePerDay: number
): { lines: RentalPricingLine[]; total: number } {
  const lines: RentalPricingLine[] = [];
  let total = 0;
  for (const p of windows) {
    if (p.billing === 'all_day') {
      if (!p.calendarDate) {
        throw new Error('all_day window missing calendar_date');
      }
      assertAllDayWindowMatchesListingOpenHours(weekly, p.calendarDate, p.start, p.end);
      const subtotal = Number(ratePerDay.toFixed(2));
      total += subtotal;
      lines.push({
        kind: 'all_day',
        calendarDate: p.calendarDate,
        ratePerDay,
        subtotal,
      });
    } else {
      const h = rentalHoursCount(p.start, p.end);
      const subtotal = Number((h * ratePerHour).toFixed(2));
      total += subtotal;
      lines.push({
        kind: 'hourly',
        startAt: p.start.toISOString(),
        endAt: p.end.toISOString(),
        billableHours: h,
        ratePerHour,
        subtotal,
      });
    }
  }
  return { lines, total: Number(total.toFixed(2)) };
}

export function estimateTotalFromSelectionRanges(
  selections: Array<{
    startMs: number;
    endMs: number;
    billing: 'hourly' | 'all_day';
    calendarDate?: string;
  }>,
  ratePerHour: number,
  ratePerDay: number
): { lines: RentalPricingLine[]; total: number } {
  const lines: RentalPricingLine[] = [];
  let total = 0;
  for (const r of selections) {
    if (r.billing === 'all_day' && r.calendarDate) {
      const subtotal = Number(ratePerDay.toFixed(2));
      total += subtotal;
      lines.push({
        kind: 'all_day',
        calendarDate: r.calendarDate,
        ratePerDay,
        subtotal,
      });
    } else {
      const h = rentalBillableHours(r.startMs, r.endMs);
      const subtotal = Number((h * ratePerHour).toFixed(2));
      total += subtotal;
      const s = new Date(r.startMs);
      const e = new Date(r.endMs);
      lines.push({
        kind: 'hourly',
        startAt: s.toISOString(),
        endAt: e.toISOString(),
        billableHours: h,
        ratePerHour,
        subtotal,
      });
    }
  }
  return { lines, total: Number(total.toFixed(2)) };
}
