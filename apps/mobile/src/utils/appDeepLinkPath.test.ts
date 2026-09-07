import { describe, expect, it } from 'vitest';
import { isGuestAccessibleDeepLinkPath } from './appDeepLinkPath';

describe('isGuestAccessibleDeepLinkPath', () => {
  it('allows the Food browse and a dish detail', () => {
    expect(isGuestAccessibleDeepLinkPath('foods')).toBe(true);
    expect(isGuestAccessibleDeepLinkPath('foods/abc-123')).toBe(true);
  });

  it('does not treat account or order links as guest-safe', () => {
    expect(isGuestAccessibleDeepLinkPath('orders/abc')).toBe(false);
    expect(isGuestAccessibleDeepLinkPath('wallet')).toBe(false);
    expect(isGuestAccessibleDeepLinkPath('rentals/abc')).toBe(false);
    expect(isGuestAccessibleDeepLinkPath('')).toBe(false);
    expect(isGuestAccessibleDeepLinkPath('food')).toBe(false);
  });
});
