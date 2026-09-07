import { describe, expect, it } from 'vitest';
import type { BusinessCatalogItem } from '../types/business/items';
import {
  isCookedFoodItem,
  resolveFoodToggleTarget,
  uniqueInventoryLocationIds,
} from './businessFood';
import { FOOD_CATEGORY_NAME } from './foodAvailability';

function item(overrides: Partial<BusinessCatalogItem> = {}): BusinessCatalogItem {
  return {
    id: 'item-1',
    name: 'Jollof',
    ...overrides,
  };
}

describe('isCookedFoodItem', () => {
  it('is true for the cooked-food category', () => {
    expect(
      isCookedFoodItem(
        item({
          item_sub_category: {
            id: 1,
            name: 'Rice',
            item_category: { id: 2, name: FOOD_CATEGORY_NAME },
          },
        })
      )
    ).toBe(true);
  });

  it('is false for groceries and missing category', () => {
    expect(isCookedFoodItem(item())).toBe(false);
    expect(
      isCookedFoodItem(
        item({
          item_sub_category: {
            id: 1,
            name: 'Rice',
            item_category: { id: 2, name: 'Food & Beverages' },
          },
        })
      )
    ).toBe(false);
  });
});

describe('resolveFoodToggleTarget', () => {
  const foodItem = {
    item_sub_category: {
      id: 1,
      name: 'Rice',
      item_category: { id: 2, name: FOOD_CATEGORY_NAME },
    },
  };

  it('returns null when the dish is not cooked food', () => {
    expect(resolveFoodToggleTarget(item())).toBeNull();
  });

  it('returns null when the dish is sold at several locations', () => {
    expect(
      resolveFoodToggleTarget(
        item({
          ...foodItem,
          business_inventories: [
            { id: 'a', quantity: 1, business_location_id: 'loc-1' },
            { id: 'b', quantity: 1, business_location_id: 'loc-2' },
          ],
        })
      )
    ).toBeNull();
  });

  it('returns the single location and sold-out flag', () => {
    const earlierToday = new Date();
    earlierToday.setHours(1, 0, 0, 0);
    const target = resolveFoodToggleTarget(
      item({
        ...foodItem,
        business_inventories: [
          { id: 'a', quantity: 1, business_location_id: 'loc-1' },
        ],
        food_item_settings: [
          {
            business_location_id: 'loc-1',
            marked_unavailable_at: earlierToday.toISOString(),
            availability_slots: [],
          },
        ],
      })
    );
    expect(target).toEqual({ businessLocationId: 'loc-1', soldOut: true });
  });
});

describe('uniqueInventoryLocationIds', () => {
  it('dedupes location ids', () => {
    expect(
      uniqueInventoryLocationIds(
        item({
          business_inventories: [
            { id: 'a', quantity: 1, business_location_id: 'loc-1' },
            { id: 'b', quantity: 1, business_location_id: 'loc-1' },
          ],
        })
      )
    ).toEqual(['loc-1']);
  });
});
