import { describe, expect, it } from 'vitest';
import { isGuestAccessibleDeepLinkPath } from './appDeepLinkPath';

describe('isGuestAccessibleDeepLinkPath', () => {
  it('allows the Food browse and a dish detail', () => {
    expect(isGuestAccessibleDeepLinkPath('foods')).toBe(true);
    expect(isGuestAccessibleDeepLinkPath('foods/abc-123')).toBe(true);
  });

  it('allows a public store page', () => {
    expect(isGuestAccessibleDeepLinkPath('store/abc-123')).toBe(true);
    expect(isGuestAccessibleDeepLinkPath('store')).toBe(false);
  });

  it('allows a public item page but not the business proposal path', () => {
    expect(isGuestAccessibleDeepLinkPath('item/abc-123')).toBe(true);
    expect(isGuestAccessibleDeepLinkPath('item')).toBe(false);
    expect(isGuestAccessibleDeepLinkPath('items/abc-123')).toBe(false);
  });

  it('does not treat account or order links as guest-safe', () => {
    expect(isGuestAccessibleDeepLinkPath('orders/abc')).toBe(false);
    expect(isGuestAccessibleDeepLinkPath('wallet')).toBe(false);
    expect(isGuestAccessibleDeepLinkPath('rentals/abc')).toBe(false);
    expect(isGuestAccessibleDeepLinkPath('')).toBe(false);
    expect(isGuestAccessibleDeepLinkPath('food')).toBe(false);
  });
});
