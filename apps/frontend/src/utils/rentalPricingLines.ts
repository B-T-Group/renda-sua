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

export type ParsedRentalWindow = {
  start: Date;
  end: Date;
  billing: 'hourly' | 'all_day';
  calendarDate?: string;
};

export function parseRentalSelectionWindowsFromJson(
  raw: unknown
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
  return [];
}

export function computeRentalPricingLines(
  windows: ParsedRentalWindow[],
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
