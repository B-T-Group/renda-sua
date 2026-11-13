import { cardRailFits } from '../rentals/rental-card-window';
import { stripeReviewFits } from '../rentals/inspection/rental-inspection.policy';
import { quotePlanTotal } from '../rentals/rental-request-edit';

export type QuoteViolation =
  | 'below_min'
  | 'above_max'
  | 'outside_hours'
  | 'units'
  | 'card_window'
  | 'own_listing';

export function quoteDayTotal(perDay: number, dayCount: number, units: number): number {
  const windows = Array.from({ length: dayCount }, (_, index) => ({
    billing: 'all_day' as const,
    start: new Date(index * 86_400_000),
    end: new Date((index + 1) * 86_400_000),
  }));
  return quotePlanTotal(windows, perDay, 0, units) ?? 0;
}

export function quoteHourlyWindow(input: {
  perHour: number;
  start: Date;
  end: Date;
  units: number;
  minHours: number;
  maxHours: number | null;
  unitsAvailable: number;
  now: Date;
  cardRail: boolean;
  reviewHours?: number;
  latestCardEndAt?: string | null;
}): { hours: number; quoteTotal: number | null; ruleViolation?: QuoteViolation } {
  const hours = Math.max(0, (input.end.getTime() - input.start.getTime()) / 3_600_000);
  if (input.units > input.unitsAvailable) {
    return { hours, quoteTotal: null, ruleViolation: 'units' };
  }
  if (hours < input.minHours) return { hours, quoteTotal: null, ruleViolation: 'below_min' };
  if (input.maxHours != null && hours > input.maxHours) {
    return { hours, quoteTotal: null, ruleViolation: 'above_max' };
  }
  const quoteTotal = quotePlanTotal(
    [{ billing: 'hourly', start: input.start, end: input.end }],
    0,
    input.perHour,
    input.units
  );
  const violation = cardWindow(input);
  return { hours, quoteTotal, ruleViolation: violation };
}

function cardWindow(input: {
  end: Date;
  now: Date;
  cardRail: boolean;
  reviewHours?: number;
  latestCardEndAt?: string | null;
}): QuoteViolation | undefined {
  if (!input.cardRail || hourlyFits(input)) return undefined;
  return 'card_window';
}

function hourlyFits(input: {
  end: Date;
  now: Date;
  reviewHours?: number;
  latestCardEndAt?: string | null;
}): boolean {
  if (!Object.prototype.hasOwnProperty.call(input, 'latestCardEndAt')) {
    return cardRailFits(input.end, input.now, input.reviewHours);
  }
  return stripeReviewFits({
    endAt: input.end,
    now: input.now,
    reviewHours: input.reviewHours,
    latest_card_end_at: input.latestCardEndAt,
  });
}
