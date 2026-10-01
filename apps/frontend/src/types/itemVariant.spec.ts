import {
  bestPackSavings,
  lineQuantityCap,
  listingHasSellableStock,
  packRebate,
  selectedAvailableUnits,
  selectionHasPurchasableStock,
  unitPriceWithListingDeal,
} from './itemVariant';

describe('unitPriceWithListingDeal', () => {
  it('subtracts a fixed listing discount from a variant price', () => {
    const pricing = unitPriceWithListingDeal(
      150,
      100,
      true,
      100,
      80,
      'fixed',
      20
    );

    expect(pricing).toEqual({
      unit: 130,
      strikeOriginal: 150,
      hasDeal: true,
    });
  });

  it('applies a percentage listing discount to a variant price', () => {
    const pricing = unitPriceWithListingDeal(
      150,
      100,
      true,
      100,
      80,
      'percentage',
      20
    );

    expect(pricing.unit).toBe(120);
  });

  it('never makes a fixed-discounted variant price negative', () => {
    const pricing = unitPriceWithListingDeal(
      10,
      100,
      true,
      100,
      0,
      'fixed',
      20
    );

    expect(pricing.unit).toBe(0);
  });

  it('keeps projected-price compatibility when deal details are absent', () => {
    const pricing = unitPriceWithListingDeal(150, 100, true, 100, 80);

    expect(pricing.unit).toBe(120);
  });
});

describe('packRebate', () => {
  it('hides a single unit and a pack that is not cheaper', () => {
    expect(packRebate({ packQuantity: 1, packPrice: 4, baseUnitPrice: 5 })).toBeNull();
    expect(packRebate({ packQuantity: 10, packPrice: 50, baseUnitPrice: 5 })).toBeNull();
  });

  it('shows the rebate for a cheaper pack of 10', () => {
    expect(packRebate({ packQuantity: 10, packPrice: 40, baseUnitPrice: 5 })).toEqual({
      saveAmount: 10,
      perUnit: 4,
      savePercent: 20,
    });
  });
});

describe('bestPackSavings', () => {
  const packs = [
    { id: 'six', name: 'Six', quantity: 6, price: 50, is_active: true },
    { id: 'ten', name: 'Ten', quantity: 10, price: 70, is_active: true },
    { id: 'hidden', name: 'Hidden', quantity: 10, price: 40, is_active: false },
  ];

  it('labels the highest active pack discount', () => {
    expect(bestPackSavings({ variants: packs, listingSellingPrice: 10 })).toEqual({
      pct: 30,
      count: 10,
    });
  });

  it('compares pack and single prices after the listing deal', () => {
    expect(
      bestPackSavings({
        variants: [{ id: 'ten', name: 'Ten', quantity: 10, price: 100, is_active: true }],
        listingSellingPrice: 100,
        hasActiveDeal: true,
        originalPrice: 100,
        discountedPrice: 80,
        discountType: 'percentage',
        discountValue: 20,
      })
    ).toEqual({ pct: 90, count: 10 });
  });

  it('hides the badge when every pack is inactive or not cheaper', () => {
    expect(
      bestPackSavings({
        variants: [{ id: 'ten', name: 'Ten', quantity: 10, price: 100, is_active: false }],
        listingSellingPrice: 10,
      })
    ).toBeNull();
  });
});

describe('lineQuantityCap', () => {
  it('uses the tighter of the merchant maximum and remaining stock', () => {
    expect(
      lineQuantityCap({ packQuantity: 10, maxOrderBaseUnits: 15, availableBaseUnits: 25 })
    ).toBe(1);
    expect(lineQuantityCap({ packQuantity: 10, availableBaseUnits: 9 })).toBe(0);
    expect(lineQuantityCap({ packQuantity: 10 })).toBeUndefined();
  });
});

describe('selectedAvailableUnits', () => {
  it('uses the parent quantity for the single option', () => {
    expect(selectedAvailableUnits(0, { available_quantity: 12 }, true)).toBe(0);
  });

  it('uses the pack quantity when a variant is selected', () => {
    expect(selectedAvailableUnits(0, { available_quantity: 12 }, false)).toBe(12);
  });
});

describe('selectionHasPurchasableStock', () => {
  it('requires a full pack before the option can be bought', () => {
    expect(
      selectionHasPurchasableStock(0, { available_quantity: 8, quantity: 10 }, false)
    ).toBe(false);
    expect(
      selectionHasPurchasableStock(0, { available_quantity: 10, quantity: 10 }, false)
    ).toBe(true);
  });
});

describe('listingHasSellableStock', () => {
  it('stays sellable when only a pack has stock', () => {
    expect(
      listingHasSellableStock(0, [
        { available_quantity: 0, quantity: 1, is_active: true },
        { available_quantity: 10, quantity: 10, is_active: true },
      ])
    ).toBe(true);
  });

  it('stays hidden when the only pack has fewer units than its size', () => {
    expect(
      listingHasSellableStock(0, [
        { available_quantity: 8, quantity: 10, is_active: true },
      ])
    ).toBe(false);
  });

  it('is sold out when the parent and every active option are empty', () => {
    expect(
      listingHasSellableStock(0, [
        { available_quantity: 4, is_active: false },
        { available_quantity: 0, is_active: true },
      ])
    ).toBe(false);
  });
});
