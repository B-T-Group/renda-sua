import { computeSellerOrderTotal } from './checkoutOrderTotal';

describe('computeSellerOrderTotal', () => {
  it('is the subtotal plus the server delivery fee', () => {
    expect(computeSellerOrderTotal(10, 5)).toBe(15);
  });

  it('fast delivery: the delivery fee already holds the fast base, so nothing is added on top', () => {
    // Canada, 3 km: normal = 2 + 3 = 5, fast replaces the base = 8 + 3 = 11 (never 5 + 8 + 3).
    const fastQuote = 8 + 3;
    expect(computeSellerOrderTotal(10, fastQuote)).toBe(21);
  });

  it('a waived delivery fee leaves just the subtotal', () => {
    expect(computeSellerOrderTotal(10, 0)).toBe(10);
  });
});
