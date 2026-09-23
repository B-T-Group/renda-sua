import type { ReorderLine } from '../types/reorder';
import {
  formatSkippedNames,
  mapReorderLineToCartLine,
  resolveReorderCartAction,
} from './reorderCart';

describe('resolveReorderCartAction', () => {
  it('returns replace for empty cart', () => {
    expect(resolveReorderCartAction([], 'biz-1')).toBe('replace');
  });

  it('returns add when cart is same business only', () => {
    expect(resolveReorderCartAction(['biz-1'], 'biz-1')).toBe('add');
  });

  it('blocks when cart has another business', () => {
    expect(resolveReorderCartAction(['biz-2'], 'biz-1')).toBe(
      'blocked_other_store'
    );
  });

  it('blocks a cart that mixes this store with another', () => {
    expect(resolveReorderCartAction(['biz-1', 'biz-2'], 'biz-1')).toBe(
      'blocked_other_store'
    );
  });
});

describe('formatSkippedNames', () => {
  const andMore = (n: number) => `and ${n} more`;

  it('formats empty, one, two, and longer lists', () => {
    expect(formatSkippedNames([], andMore)).toBe('');
    expect(formatSkippedNames(['A'], andMore)).toBe('A');
    expect(formatSkippedNames(['A', 'B'], andMore)).toBe('A, B');
    expect(formatSkippedNames(['A', 'B', 'C'], andMore)).toBe('A, B and 1 more');
  });
});

describe('mapReorderLineToCartLine', () => {
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
      image_url: null,
      max_order_quantity: 3,
      min_order_quantity: 1,
      pay_on_delivery_enabled: true,
      business_name: 'Store',
      seller_country: 'CM',
      merchant_can_accept_orders: false,
    },
  };

  it('copies seller country, pay-on-delivery, and variant onto the cart line', () => {
    expect(mapReorderLineToCartLine(line, 'biz-1')).toMatchObject({
      inventoryItemId: 'inv-1',
      variantId: 'var-1',
      variantName: 'Small',
      quantity: 2,
      businessId: 'biz-1',
      businessLocationId: 'loc-1',
      businessName: 'Store',
      sellerCountry: 'CM',
      itemData: {
        price: 750,
        currency: 'XAF',
        payOnDeliveryEnabled: true,
        merchantCanAcceptOrders: false,
        maxOrderQuantity: 3,
      },
    });
  });

  it('omits variant fields when the line has no variant', () => {
    const mapped = mapReorderLineToCartLine(
      { ...line, item_variant_id: null, variant_name: null },
      'biz-1'
    );
    expect(mapped.variantId).toBeUndefined();
    expect(mapped.variantName).toBeUndefined();
  });
});
