import { describe, expect, it } from 'vitest';
import { isShippingPriceValid, parseShippingPrice } from './itemFulfillment';

describe('parseShippingPrice', () => {
  it('accepts zero as free shipping', () => {
    expect(parseShippingPrice('0')).toBe(0);
  });

  it('rejects empty and negative values', () => {
    expect(parseShippingPrice('')).toBeNull();
    expect(parseShippingPrice('  ')).toBeNull();
    expect(parseShippingPrice('-1')).toBeNull();
  });
});

describe('isShippingPriceValid', () => {
  it('is valid when shipping is off', () => {
    expect(isShippingPriceValid(false, '')).toBe(true);
  });

  it('requires a non-negative price when shipping is on', () => {
    expect(isShippingPriceValid(true, '')).toBe(false);
    expect(isShippingPriceValid(true, '500')).toBe(true);
  });
});
