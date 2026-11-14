import { quoteDayTotal, quoteHourlyWindow } from './assistant-rental-quote';
import { quotePlanTotal } from '../rentals/rental-request-edit';

describe('rental quotes', () => {
  it('matches quotePlanTotal for one day and for an 8 hour window', () => {
    expect(quoteDayTotal(2500, 1, 1)).toBe(2500);
    const start = new Date('2026-11-14T08:00:00.000Z');
    const end = new Date('2026-11-14T16:00:00.000Z');
    const quoted = quoteHourlyWindow({
      perHour: 1000,
      start,
      end,
      units: 2,
      minHours: 4,
      maxHours: 12,
      unitsAvailable: 2,
      now: new Date('2026-11-13T12:00:00.000Z'),
      cardRail: false,
    });
    expect(quoted.ruleViolation).toBeUndefined();
    expect(quoted.quoteTotal).toBe(
      quotePlanTotal([{ billing: 'hourly', start, end }], 0, 1000, 2)
    );
  });

  it('uses stripeReviewFits for a card rail and ignores it for mobile money', () => {
    const now = new Date('2026-11-13T12:00:00.000Z');
    const start = new Date('2026-11-13T13:00:00.000Z');
    const near = quoteHourlyWindow({
      perHour: 1000,
      start,
      end: new Date(now.getTime() + 2 * 86_400_000),
      units: 1,
      minHours: 1,
      maxHours: null,
      unitsAvailable: 1,
      now,
      cardRail: true,
    });
    const late = quoteHourlyWindow({
      perHour: 1000,
      start,
      end: new Date(now.getTime() + 4 * 86_400_000),
      units: 1,
      minHours: 1,
      maxHours: null,
      unitsAvailable: 1,
      now,
      cardRail: true,
    });
    const momo = quoteHourlyWindow({
      perHour: 1000,
      start,
      end: new Date(now.getTime() + 4 * 86_400_000),
      units: 1,
      minHours: 1,
      maxHours: null,
      unitsAvailable: 1,
      now,
      cardRail: false,
    });
    expect(near.ruleViolation).toBeUndefined();
    expect(late.ruleViolation).toBe('card_window');
    expect(momo.ruleViolation).toBeUndefined();
  });

  it('returns below_min for 2 hours when the listing requires 4', () => {
    const start = new Date('2026-11-14T09:00:00.000Z');
    const end = new Date('2026-11-14T11:00:00.000Z');
    const quoted = quoteHourlyWindow({
      perHour: 1000,
      start,
      end,
      units: 1,
      minHours: 4,
      maxHours: null,
      unitsAvailable: 1,
      now: new Date('2026-11-13T12:00:00.000Z'),
      cardRail: false,
    });
    expect(quoted.ruleViolation).toBe('below_min');
    expect(quoted.quoteTotal).toBeNull();
  });
});
