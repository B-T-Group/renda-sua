import { describe, expect, it } from 'vitest';
import { nextDeliveryUnavailableLatch } from './deliveryAvailabilityLatch';

describe('nextDeliveryUnavailableLatch', () => {
  it('sets latch when delivery is unavailable', () => {
    expect(nextDeliveryUnavailableLatch(false, { available: false })).toBe(true);
  });

  it('clears latch when delivery becomes available', () => {
    expect(nextDeliveryUnavailableLatch(true, { available: true })).toBe(false);
  });

  it('keeps previous value when availability is omitted (e.g. pickup preflight)', () => {
    expect(nextDeliveryUnavailableLatch(true, null)).toBe(true);
    expect(nextDeliveryUnavailableLatch(true, undefined)).toBe(true);
    expect(nextDeliveryUnavailableLatch(false, null)).toBe(false);
  });
});
