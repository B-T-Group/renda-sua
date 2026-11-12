import type {
  RentalPricingLine,
  RentalPricingSnapshotDto,
} from './dto/rental-pricing-snapshot.dto';
import { quotePlanTotal } from './rental-request-edit';

export interface QuoteWindow {
  billing?: string;
  calendarDate?: string;
  start: Date;
  end: Date;
}

export interface RentalRequestQuote {
  quotedTotal: number;
  snapshot: RentalPricingSnapshotDto;
}

const HOUR_MS = 3_600_000;

/** Freeze the contract total, lines, and deposit when a request is created. */
export function buildRentalRequestQuote(input: {
  windows: QuoteWindow[];
  dayRate: number;
  hourRate: number;
  units: number;
  currency: string;
  securityDepositPerUnit: number;
  computedAt: string;
}): RentalRequestQuote | null {
  const quotedTotal = quotePlanTotal(
    input.windows,
    input.dayRate,
    input.hourRate,
    input.units
  );
  if (quotedTotal == null) return null;
  const units = normalizeUnits(input.units);
  const day = finiteOrZero(input.dayRate);
  const hour = finiteOrZero(input.hourRate);
  const depositPer = input.securityDepositPerUnit > 0 ? input.securityDepositPerUnit : 0;
  return {
    quotedTotal,
    snapshot: {
      version: 4,
      currency: input.currency || 'XAF',
      total: quotedTotal,
      unitsBooked: units,
      securityDeposit: Number((finiteOrZero(depositPer) * units).toFixed(2)),
      lines: input.windows.map((row) => quoteLine(row, day, hour, units)),
      computedAt: input.computedAt,
    },
  };
}

function quoteLine(
  row: QuoteWindow,
  day: number,
  hour: number,
  units: number
): RentalPricingLine {
  if (row.billing === 'all_day') {
    return {
      kind: 'all_day',
      calendarDate: row.calendarDate ?? row.start.toISOString().slice(0, 10),
      ratePerDay: day,
      subtotal: Number((day * units).toFixed(2)),
    };
  }
  const billableHours = Math.max(1, Math.ceil((row.end.getTime() - row.start.getTime()) / HOUR_MS));
  return {
    kind: 'hourly',
    startAt: row.start.toISOString(),
    endAt: row.end.toISOString(),
    billableHours,
    ratePerHour: hour,
    subtotal: Number((billableHours * hour * units).toFixed(2)),
  };
}

function normalizeUnits(value: number): number {
  const units = Math.floor(Number(value));
  return Number.isFinite(units) && units >= 1 ? units : 1;
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}
