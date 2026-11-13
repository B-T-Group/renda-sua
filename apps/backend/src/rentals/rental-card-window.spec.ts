import { stripeReviewFits } from './inspection/rental-inspection.policy';
import {
  cardRailFits,
  cardWindowFields,
  clampExclusiveRange,
  latestCardEndAt,
  latestExclusiveEndDate,
  readLatestCardEndAt,
  resolveCardPaymentPolicy,
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
      mode: 'authorize_upfront',
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

  it('charges at pickup only for an inspected Stripe booking and then does not clamp', () => {
    const pickup = resolveCardPaymentPolicy({
      rail: 'stripe',
      timezone: 'Africa/Douala',
      now: NOW,
      chargeAtPickupEnabled: true,
      inspected: true,
    });
    expect(pickup.mode).toBe('charge_at_pickup');
    expect(pickup.latest_card_end_at).toBeNull();
    expect(stripeReviewFits({ endAt: new Date(NOW.getTime() + 4 * DAY), now: NOW, latest_card_end_at: null })).toBe(true);
    const open = clampExclusiveRange({
      startDate: '2026-11-14',
      endDate: '2026-11-20',
      dayCount: 6,
      latestCardEndAt: null,
      zone: 'Africa/Douala',
      today: '2026-11-13',
    });
    expect(open.fits).toBe(true);
    expect(open.offer?.endDate).toBe('2026-11-20');
  });

  it('keeps authorize_upfront unless the flag is on and the Stripe booking is inspected', () => {
    const momo = resolveCardPaymentPolicy({ rail: 'mobile_money', timezone: 'Africa/Douala', now: NOW });
    expect(momo.mode).toBe('authorize_upfront');
    expect(momo.latest_card_end_at).toBeNull();
    expect(momo.momo_available).toBe(true);
    const flagOff = resolveCardPaymentPolicy({
      rail: 'stripe',
      timezone: 'Africa/Douala',
      now: NOW,
      chargeAtPickupEnabled: false,
      inspected: true,
    });
    expect(flagOff.mode).toBe('authorize_upfront');
    expect(flagOff.latest_card_end_at).toEqual(expect.any(String));
    const notInspected = resolveCardPaymentPolicy({
      rail: 'stripe',
      timezone: 'Africa/Douala',
      now: NOW,
      chargeAtPickupEnabled: true,
      inspected: false,
    });
    expect(notInspected.mode).toBe('authorize_upfront');
    const latest = flagOff.latest_card_end_at as string;
    expect(stripeReviewFits({ endAt: new Date(latest), now: NOW, latest_card_end_at: latest })).toBe(true);
    expect(stripeReviewFits({ endAt: new Date(Date.parse(latest) + 1), now: NOW, latest_card_end_at: latest })).toBe(false);
  });
});
