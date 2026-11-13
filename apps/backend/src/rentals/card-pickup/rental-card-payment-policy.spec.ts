import { resolveCardPaymentPolicy } from './rental-card-payment-policy';
import { stripeReviewFits } from '../inspection/rental-inspection.policy';

const now = new Date('2026-11-13T12:00:00.000Z');

describe('resolveCardPaymentPolicy', () => {
  it('returns charge at pickup and no end limit for an inspected Stripe booking', () => {
    const policy = resolveCardPaymentPolicy({
      rail: 'stripe',
      inspected: true,
      chargeAtPickupEnabled: true,
      endAt: new Date(now.getTime() + 20 * 86400000),
      now,
      timezone: 'Africa/Douala',
    });
    expect(policy.mode).toBe('charge_at_pickup');
    expect(policy.latest_card_end_at).toBeNull();
    expect(policy.payment_rail).toBe('stripe');
    expect(policy.momo_available).toBe(false);
    expect(policy.stripe_review_hours).toBe(72);
    expect(policy.timezone).toBe('Africa/Douala');
  });

  it('keeps the 6-day end when the flag is off', () => {
    const policy = resolveCardPaymentPolicy({
      rail: 'stripe',
      inspected: true,
      chargeAtPickupEnabled: false,
      now,
    });
    expect(policy.mode).toBe('authorize_upfront');
    expect(policy.latest_card_end_at).toBe(new Date(now.getTime() + 6 * 86400000 - 72 * 3600000).toISOString());
  });

  it('keeps the window for a booking that is already authorized', () => {
    const policy = resolveCardPaymentPolicy({
      rail: 'stripe',
      inspected: true,
      chargeAtPickupEnabled: true,
      alreadyAuthorized: true,
      now,
    });
    expect(policy.mode).toBe('authorize_upfront');
    expect(policy.latest_card_end_at).not.toBeNull();
  });

  it('does not apply to mobile money', () => {
    const policy = resolveCardPaymentPolicy({
      rail: 'mobile_money',
      inspected: true,
      chargeAtPickupEnabled: true,
      now,
    });
    expect(policy.mode).toBe('authorize_upfront');
    expect(policy.momo_available).toBe(true);
    expect(policy.latest_card_end_at).toBeNull();
  });

  it('is what stripeReviewFits reads', () => {
    const endAt = new Date(now.getTime() + 20 * 86400000);
    expect(stripeReviewFits({ endAt, now, chargeAtPickupEnabled: true })).toBe(true);
    expect(stripeReviewFits({ endAt, now })).toBe(false);
  });
});
