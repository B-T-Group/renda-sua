import { stripeReviewFits } from './inspection/rental-inspection.policy';
import {
  cardRailFits,
  cardWindowFields,
  clampExclusiveRange,
  latestCardEndAt,
  latestExclusiveEndDate,
  readLatestCardEndAt,
} from './rental-card-window';

const NOW = new Date('2026-11-13T12:00:00.000Z');
const DAY = 86_400_000;

describe('card window', () => {
  it('matches stripeReviewFits at the latest end and at the policy boundaries', () => {
    const latest = latestCardEndAt(NOW);
    expect(stripeReviewFits({ endAt: latest, now: NOW })).toBe(true);
    expect(cardRailFits(latest, NOW)).toBe(true);
    expect(stripeReviewFits({ endAt: new Date(latest.getTime() + 1), now: NOW })).toBe(false);
    expect(stripeReviewFits({ endAt: new Date(NOW.getTime() + 2 * DAY), now: NOW })).toBe(true);
    expect(stripeReviewFits({ endAt: new Date(NOW.getTime() + 4 * DAY), now: NOW })).toBe(false);
  });

  it('keeps a provided latest_card_end_at and names the five fields', () => {
    const provided = '2026-11-15T08:00:00.000Z';
    const fields = cardWindowFields({
      now: NOW,
      rail: 'stripe',
      timezone: 'Africa/Douala',
      latestCardEndAt: provided,
    });
    expect(fields).toEqual({
      latest_card_end_at: provided,
      payment_rail: 'stripe',
      momo_available: false,
      stripe_review_hours: 72,
      timezone: 'Africa/Douala',
    });
    expect(readLatestCardEndAt({ latest_card_end_at: provided })).toBe(provided);
    expect(readLatestCardEndAt({})).toBeNull();
  });

  it('offers only exclusive ends on or before latest_card_end_at in the market zone', () => {
    const latest = latestCardEndAt(NOW).toISOString();
    const cap = latestExclusiveEndDate(latest, 'Africa/Douala');
    expect(cap).toBe('2026-11-16');
    const fitting = clampExclusiveRange({
      startDate: '2026-11-14',
      endDate: '2026-11-15',
      dayCount: 1,
      latestCardEndAt: latest,
      zone: 'Africa/Douala',
      today: '2026-11-13',
    });
    expect(fitting.fits).toBe(true);
    expect(fitting.offer).toEqual({ startDate: '2026-11-14', endDate: '2026-11-15', dayCount: 1 });
    const late = clampExclusiveRange({
      startDate: '2026-11-14',
      endDate: '2026-11-20',
      dayCount: 6,
      latestCardEndAt: latest,
      zone: 'Africa/Douala',
      today: '2026-11-13',
    });
    expect(late.fits).toBe(false);
    expect(late.offer).toEqual({ startDate: '2026-11-14', endDate: '2026-11-16', dayCount: 2 });
    const after = clampExclusiveRange({
      startDate: '2026-11-17',
      endDate: '2026-11-18',
      dayCount: 1,
      latestCardEndAt: latest,
      zone: 'Africa/Douala',
      today: '2026-11-13',
    });
    expect(after.offer).toEqual({ startDate: '2026-11-15', endDate: '2026-11-16', dayCount: 1 });
  });
});
