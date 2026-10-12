import type {
  DeliveryEarningsPeriod,
  DeliveryPayRates,
  DeliveryPayoutRow,
  DeliveryTrip,
} from './agent-delivery-earnings.types';

const DELIVERY_TYPES = new Set(['base_delivery_fee', 'per_km_delivery_fee']);

export function parseDeliveryPeriod(value?: string): DeliveryEarningsPeriod {
  if (value === 'last_month' || value === 'all') return value;
  return 'month';
}

export function deliveryPayRates(input: {
  normalBaseFee: number;
  fastBaseFee: number;
  perKmFee: number;
  basePercent: number;
  perKmPercent: number;
}): DeliveryPayRates {
  const baseAmount = shareAmount(input.normalBaseFee, input.basePercent);
  const fastAmount = shareAmount(input.fastBaseFee, input.basePercent);
  return {
    baseAmount,
    fastBaseAmount: fastAmount === baseAmount ? null : fastAmount,
    perKmAmount: shareAmount(input.perKmFee, input.perKmPercent),
  };
}

export function periodBounds(
  period: DeliveryEarningsPeriod,
  now: Date,
  timeZone: string
): { start: string | null; end: string | null } {
  if (period === 'all') return { start: null, end: null };
  const zone = safeZone(timeZone);
  const current = zonedYearMonth(now, zone);
  const target = period === 'month' ? current : previousMonth(current);
  return {
    start: zonedMidnight(target, zone).toISOString(),
    end: zonedMidnight(nextMonth(target), zone).toISOString(),
  };
}

export function groupDeliveryTrips(rows: DeliveryPayoutRow[]): DeliveryTrip[] {
  const trips = new Map<string, DeliveryTrip>();
  for (const row of rows) addDeliveryRow(trips, row);
  return [...trips.values()].sort(newerFirst);
}

function shareAmount(fee: number, percent: number): number {
  return Math.round((fee * percent) / 100);
}

function safeZone(timeZone: string): string {
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return timeZone;
  } catch {
    return 'UTC';
  }
}

interface YearMonth {
  year: number;
  month: number;
}

function zonedYearMonth(now: Date, timeZone: string): YearMonth {
  const parts = zonedParts(now, timeZone);
  return { year: parts.year, month: parts.month };
}

function previousMonth(value: YearMonth): YearMonth {
  if (value.month === 1) return { year: value.year - 1, month: 12 };
  return { year: value.year, month: value.month - 1 };
}

function nextMonth(value: YearMonth): YearMonth {
  if (value.month === 12) return { year: value.year + 1, month: 1 };
  return { year: value.year, month: value.month + 1 };
}

function zonedMidnight(value: YearMonth, timeZone: string): Date {
  const guess = Date.UTC(value.year, value.month - 1, 1);
  return new Date(guess - tzOffsetMs(new Date(guess), timeZone));
}

function tzOffsetMs(date: Date, timeZone: string): number {
  const parts = zonedParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  return asUtc - date.getTime();
}

function zonedParts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const bag: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== 'literal') bag[part.type] = part.value;
  }
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour: Number(bag.hour === '24' ? '0' : bag.hour),
    minute: Number(bag.minute),
    second: Number(bag.second),
  };
}

function addDeliveryRow(trips: Map<string, DeliveryTrip>, row: DeliveryPayoutRow) {
  if (!DELIVERY_TYPES.has(row.commissionType) || !row.orderId) return;
  trips.set(row.orderId, mergeTrip(trips.get(row.orderId), row));
}

function mergeTrip(current: DeliveryTrip | undefined, row: DeliveryPayoutRow): DeliveryTrip {
  return {
    orderId: row.orderId,
    orderNumber: row.orderNumber || current?.orderNumber || '',
    deliveredAt: row.deliveredAt ?? current?.deliveredAt ?? row.createdAt,
    amount: (current?.amount ?? 0) + row.amount,
  };
}

function newerFirst(a: DeliveryTrip, b: DeliveryTrip): number {
  return Date.parse(b.deliveredAt ?? '') - Date.parse(a.deliveredAt ?? '');
}
