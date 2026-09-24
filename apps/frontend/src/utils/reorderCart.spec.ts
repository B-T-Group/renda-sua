import type { ReorderLine } from '../types/reorder';
import {
  formatSkippedNames,
  mapReorderLineToCartItem,
  resolveReorderCartAction,
} from './reorderCart';

describe('resolveReorderCartAction', () => {
  it('returns replace for empty cart', () => {
    expect(resolveReorderCartAction([], 'biz-1')).toBe('replace');
  });

  it('returns add when same business', () => {
    expect(resolveReorderCartAction(['biz-1'], 'biz-1')).toBe('add');
  });

  it('blocks other store', () => {
    expect(resolveReorderCartAction(['biz-2'], 'biz-1')).toBe(
      'blocked_other_store'
    );
  });

  it('blocks when the cart mixes this store with another', () => {
    expect(resolveReorderCartAction(['biz-1', 'biz-2'], 'biz-1')).toBe(
      'blocked_other_store'
    );
  });
});

describe('formatSkippedNames', () => {
  const andMore = (n: number) => `and ${n} more`;

  it('formats empty, one, and two names', () => {
    expect(formatSkippedNames([], andMore)).toBe('');
    expect(formatSkippedNames(['A'], andMore)).toBe('A');
    expect(formatSkippedNames(['A', 'B'], andMore)).toBe('A, B');
  });

  it('formats more than two names', () => {
    expect(formatSkippedNames(['A', 'B', 'C', 'D'], andMore)).toBe(
      'A, B and 2 more'
    );
  });
});

describe('mapReorderLineToCartItem', () => {
  const line: ReorderLine = {
    business_inventory_id: 'inv-1',
    item_id: 'item-1',
    item_variant_id: 'var-1',
    quantity: 2,
    ordered_quantity: 4,
    variant_name: 'Small',
    business_location_id: 'loc-1',
    item_data: {
      name: 'Rice',
      price: 750,
      currency: 'XAF',
      image_url: 'https://img/rice.jpg',
      max_order_quantity: 3,
      min_order_quantity: 1,
      merchant_can_accept_orders: false,
    },
  };

  it('copies variant, price, and merchant flag onto the cart line', () => {
    expect(mapReorderLineToCartItem(line, 'biz-1')).toEqual({
      inventoryItemId: 'inv-1',
      variantId: 'var-1',
      variantName: 'Small',
      quantity: 2,
      businessId: 'biz-1',
      businessLocationId: 'loc-1',
      itemData: {
        name: 'Rice',
        price: 750,
        currency: 'XAF',
        imageUrl: 'https://img/rice.jpg',
        maxOrderQuantity: 3,
        minOrderQuantity: 1,
        merchantCanAcceptOrders: false,
      },
    });
  });

  it('omits variant fields when the line has no variant', () => {
    const mapped = mapReorderLineToCartItem(
      {
        ...line,
        item_variant_id: null,
        variant_name: null,
        item_data: { ...line.item_data, image_url: null },
      },
      'biz-1'
    );
    expect(mapped.variantId).toBeUndefined();
    expect(mapped.variantName).toBeUndefined();
    expect(mapped.itemData.imageUrl).toBeUndefined();
    expect(mapped.quantity).toBe(2);
  });
});
