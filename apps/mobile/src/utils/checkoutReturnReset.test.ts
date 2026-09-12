import { describe, expect, it } from 'vitest';
import { checkoutReturnReset } from './checkoutReturnReset';

describe('checkoutReturnReset', () => {
  it('returns to Place Order with the original inventory item', () => {
    expect(
      checkoutReturnReset({
        to: 'place-order',
        inventoryItemId: 'inv-1',
        variantId: 'var-2',
      })
    ).toEqual({
      index: 1,
      routes: [
        { name: 'ClientMainTabs' },
        {
          name: 'PlaceOrder',
          params: { inventoryItemId: 'inv-1', variantId: 'var-2' },
        },
      ],
    });
  });

  it('omits variantId when the shopper started from a base item', () => {
    const reset = checkoutReturnReset({
      to: 'place-order',
      inventoryItemId: 'inv-1',
    });
    expect(reset.routes[1]).toEqual({
      name: 'PlaceOrder',
      params: { inventoryItemId: 'inv-1' },
    });
  });

  it('returns to cart checkout instead of an empty cart', () => {
    expect(checkoutReturnReset({ to: 'cart-checkout' })).toEqual({
      index: 2,
      routes: [
        { name: 'ClientMainTabs' },
        { name: 'Cart' },
        { name: 'CartCheckout' },
      ],
    });
  });

  it('falls back to client tabs when origin is missing', () => {
    expect(checkoutReturnReset(undefined)).toEqual({
      index: 0,
      routes: [{ name: 'ClientMainTabs' }],
    });
  });
});
