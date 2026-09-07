import { describe, expect, it } from 'vitest';
import {
  cartShippingAvailability,
  fulfillmentNeedsAddress,
  fulfillmentNeedsWindow,
} from './fulfillmentMethod';

describe('fulfillmentNeedsAddress', () => {
  it('requires an address for delivery and shipping', () => {
    expect(fulfillmentNeedsAddress('delivery')).toBe(true);
    expect(fulfillmentNeedsAddress('shipping')).toBe(true);
    expect(fulfillmentNeedsAddress('pickup')).toBe(false);
  });
});

describe('fulfillmentNeedsWindow', () => {
  it('skips agent windows for carrier shipping', () => {
    expect(fulfillmentNeedsWindow('shipping')).toBe(false);
    expect(fulfillmentNeedsWindow('delivery')).toBe(true);
    expect(fulfillmentNeedsWindow('pickup')).toBe(true);
  });
});

describe('cartShippingAvailability', () => {
  it('is eligible only when every group can ship', () => {
    expect(
      cartShippingAvailability([
        { shipping_eligible: true },
        { shipping_eligible: true },
      ])
    ).toEqual({ eligible: true, partial: false });
  });

  it('is partial when only some groups can ship', () => {
    expect(
      cartShippingAvailability([
        { shipping_eligible: true },
        { shipping_eligible: false },
      ])
    ).toEqual({ eligible: false, partial: true });
  });

  it('is not eligible for an empty cart', () => {
    expect(cartShippingAvailability([])).toEqual({ eligible: false, partial: false });
  });
});
