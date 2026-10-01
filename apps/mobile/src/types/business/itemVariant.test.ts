import { bestPackSavings, orderLineBounds } from './itemVariant';

describe('bestPackSavings', () => {
  it('labels the highest active pack discount', () => {
    expect(
      bestPackSavings({
        variants: [
          { id: 'six', name: 'Six', quantity: 6, price: 50, is_active: true },
          { id: 'ten', name: 'Ten', quantity: 10, price: 70, is_active: true },
          { id: 'hidden', name: 'Hidden', quantity: 10, price: 40, is_active: false },
        ],
        listingSellingPrice: 10,
      })
    ).toEqual({ pct: 30, count: 10 });
  });

  it('compares pack and single prices after the listing deal', () => {
    expect(
      bestPackSavings({
        variants: [{ id: 'ten', name: 'Ten', quantity: 10, price: 100, is_active: true }],
        listingSellingPrice: 100,
        hasActiveDeal: true,
        originalPrice: 100,
        discountedPrice: 80,
      })
    ).toEqual({ pct: 90, count: 10 });
  });
});

describe('orderLineBounds', () => {
  it('caps cooked food by the merchant maximum in packs', () => {
    expect(
      orderLineBounds({
        available: 0,
        maxOrder: 20,
        packQuantity: 6,
        ignoresStock: true,
      })
    ).toEqual({ min: 1, max: 3 });
  });

  it('blocks a pack that does not fit in the remaining units', () => {
    expect(
      orderLineBounds({
        available: 9,
        maxOrder: 15,
        packQuantity: 10,
        ignoresStock: false,
      })
    ).toEqual({ min: 0, max: 0 });
  });

  it('caps a pack at the merchant maximum when stock would allow more', () => {
    expect(
      orderLineBounds({
        available: 40,
        maxOrder: 15,
        minOrder: 1,
        packQuantity: 10,
        ignoresStock: false,
      })
    ).toEqual({ min: 1, max: 1 });
  });
});
