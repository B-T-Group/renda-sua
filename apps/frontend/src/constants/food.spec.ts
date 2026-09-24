import {
  applyFoodOnlyCatalogFilter,
  FOOD_CATEGORY_NAME,
  FOOD_ORDER_SOFT_MAX,
  isFoodCatalogItem,
  isFoodCategoryName,
  placeOrderMaxQuantity,
} from './food';

function cookedFood(name = 'Restaurant & Cooked Food') {
  return {
    item: { item_sub_category: { item_category: { name } } },
  };
}

describe('isFoodCategoryName', () => {
  it('matches only the cooked-food category', () => {
    expect(isFoodCategoryName(FOOD_CATEGORY_NAME)).toBe(true);
    expect(isFoodCategoryName(` ${FOOD_CATEGORY_NAME} `)).toBe(true);
    expect(isFoodCategoryName('Food & Beverages')).toBe(false);
    expect(isFoodCategoryName('')).toBe(false);
    expect(isFoodCategoryName(null)).toBe(false);
  });
});

describe('isFoodCatalogItem', () => {
  it('reads the category from a nested inventory item', () => {
    expect(isFoodCatalogItem(cookedFood())).toBe(true);
  });

  it('reads a top-level category used by some catalog payloads', () => {
    const actual = isFoodCatalogItem({
      item_sub_category: { item_category: { name: FOOD_CATEGORY_NAME } },
    });

    expect(actual).toBe(true);
  });

  it('rejects groceries and rows with no category', () => {
    expect(isFoodCatalogItem(cookedFood('Food & Beverages'))).toBe(false);
    expect(isFoodCatalogItem({})).toBe(false);
  });
});

describe('applyFoodOnlyCatalogFilter', () => {
  const pizza = cookedFood();
  const grocery = cookedFood('Food & Beverages');
  const pagination = { total: 50, totalPages: 3 };

  it('leaves a mixed page alone when food_only is off', () => {
    const actual = applyFoodOnlyCatalogFilter(
      [pizza, grocery],
      false,
      pagination
    );

    expect(actual.items).toHaveLength(2);
    expect(actual.total).toBe(50);
    expect(actual.totalPages).toBe(3);
  });

  it('drops leaked grocery rows from the Foods catalog', () => {
    const actual = applyFoodOnlyCatalogFilter(
      [pizza, grocery],
      true,
      pagination
    );

    expect(actual.items).toEqual([pizza]);
    expect(actual.total).toBe(1);
    expect(actual.totalPages).toBe(1);
  });

  it('keeps the server totals when every row is cooked food', () => {
    const actual = applyFoodOnlyCatalogFilter([pizza], true, pagination);

    expect(actual.items).toEqual([pizza]);
    expect(actual.total).toBe(50);
    expect(actual.totalPages).toBe(3);
  });
});

describe('placeOrderMaxQuantity', () => {
  it('lets cooked food exceed the quantity-1 visibility sentinel', () => {
    const actual = placeOrderMaxQuantity({
      computed_available_quantity: 1,
      ...cookedFood(),
    });

    expect(actual).toBe(FOOD_ORDER_SOFT_MAX);
  });

  it('still honors a merchant maximum on cooked food', () => {
    const dish = cookedFood();
    const actual = placeOrderMaxQuantity({
      computed_available_quantity: 1,
      item: { ...dish.item, max_order_quantity: 3 },
    });

    expect(actual).toBe(3);
  });

  it('caps retail at stock and the default maximum of 10', () => {
    expect(
      placeOrderMaxQuantity({
        computed_available_quantity: 1,
        item: { max_order_quantity: null },
      })
    ).toBe(1);
    expect(
      placeOrderMaxQuantity({
        computed_available_quantity: 40,
        item: { max_order_quantity: null },
      })
    ).toBe(10);
    expect(
      placeOrderMaxQuantity({
        computed_available_quantity: 40,
        item: { max_order_quantity: 4 },
      })
    ).toBe(4);
  });
});
