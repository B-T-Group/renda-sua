import { describe, expect, it } from 'vitest';
import type { BusinessCatalogItem } from '../types/business/items';
import { FOOD_CATEGORY_NAME } from './foodAvailability';
import { itemHasLowStock, itemIsOutOfStock } from './businessItemUtils';

function item(overrides: Partial<BusinessCatalogItem> = {}): BusinessCatalogItem {
  return {
    id: 'item-1',
    name: 'Widget',
    business_inventories: [
      {
        id: 'inv-1',
        quantity: 4,
        computed_available_quantity: 4,
        is_active: true,
      },
    ],
    ...overrides,
  };
}

function cooked(overrides: Partial<BusinessCatalogItem> = {}): BusinessCatalogItem {
  return item({
    name: 'Jollof',
    item_sub_category: {
      id: 1,
      name: 'Local Dishes',
      item_category: { id: 2, name: FOOD_CATEGORY_NAME },
    },
    business_inventories: [
      {
        id: 'inv-1',
        quantity: 1,
        computed_available_quantity: 0,
        is_active: true,
      },
    ],
    ...overrides,
  });
}

describe('itemIsOutOfStock', () => {
  it('keeps an active cooked-food dish in stock when the sentinel is zero', () => {
    expect(itemIsOutOfStock(cooked())).toBe(false);
  });

  it('treats cooked food as out of stock only when every location is inactive', () => {
    const dish = cooked({
      business_inventories: [
        {
          id: 'inv-1',
          quantity: 1,
          computed_available_quantity: 1,
          is_active: false,
        },
      ],
    });
    expect(itemIsOutOfStock(dish)).toBe(true);
  });

  it('treats retail with no available quantity as out of stock', () => {
    const retail = item({
      business_inventories: [
        { id: 'inv-1', quantity: 0, computed_available_quantity: 0, is_active: true },
      ],
    });
    expect(itemIsOutOfStock(retail)).toBe(true);
  });
});

describe('itemHasLowStock', () => {
  it('never flags cooked food as low stock', () => {
    const dish = cooked({
      business_inventories: [
        {
          id: 'inv-1',
          quantity: 1,
          computed_available_quantity: 1,
          reserved_quantity: 0,
          is_active: true,
          reorder_point: 5,
        },
      ],
    });
    expect(itemHasLowStock(dish)).toBe(false);
  });

  it('flags retail when available quantity is within the reorder point', () => {
    const retail = item({
      business_inventories: [
        {
          id: 'inv-1',
          quantity: 2,
          computed_available_quantity: 2,
          is_active: true,
          reorder_point: 5,
        },
      ],
    });
    expect(itemHasLowStock(retail)).toBe(true);
  });
});
