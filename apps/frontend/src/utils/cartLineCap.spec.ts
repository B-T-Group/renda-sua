import { cappedCartQuantity } from './cartLineCap';

const singles = {
  inventoryItemId: 'inv-1',
  quantity: 3,
  itemData: { packQuantity: 1, availableQuantity: 12 },
};

const pack = {
  inventoryItemId: 'inv-1',
  variantId: 'pack',
  quantity: 1,
  itemData: { packQuantity: 10, availableQuantity: 12 },
};

describe('cappedCartQuantity', () => {
  it('leaves quantity alone when the line has no stock or order cap', () => {
    const uncapped = { ...pack, itemData: { packQuantity: 10 } };
    expect(cappedCartQuantity(uncapped, 4, [])).toBe(4);
  });

  it('refuses another pack when singles already use the shared stock', () => {
    expect(cappedCartQuantity(pack, 1, [singles])).toBe(0);
  });

  it('allows one pack when two singles leave ten units', () => {
    const twoSingles = { ...singles, quantity: 2 };
    expect(cappedCartQuantity(pack, 2, [twoSingles])).toBe(1);
  });

  it('caps packs at the merchant maximum in base units', () => {
    const limited = {
      ...pack,
      itemData: { packQuantity: 10, maxOrderQuantity: 15, availableQuantity: 100 },
    };
    expect(cappedCartQuantity(limited, 3, [])).toBe(1);
  });
});
