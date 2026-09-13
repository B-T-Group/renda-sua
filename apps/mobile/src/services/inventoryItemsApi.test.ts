import { describe, expect, it } from 'vitest';
import { FOOD_CATEGORY_NAME } from '../utils/foodAvailability';
import { buildInventoryItemsQuery } from './inventoryItemsApi';

describe('buildInventoryItemsQuery', () => {
  it('pins the cooked-food category when food_only is set', () => {
    const query = buildInventoryItemsQuery({ food_only: true, page: 1, limit: 25 });
    expect(query.get('food_only')).toBe('true');
    expect(query.get('category')).toBe(FOOD_CATEGORY_NAME);
  });

  it('does not add a category on the general marketplace list', () => {
    const query = buildInventoryItemsQuery({ page: 1, limit: 25 });
    expect(query.get('food_only')).toBeNull();
    expect(query.get('category')).toBeNull();
  });

  it('keeps an explicit subcategory filter on the Food tab', () => {
    const query = buildInventoryItemsQuery({
      food_only: true,
      subcategory: 'Grilled',
    });
    expect(query.get('category')).toBe(FOOD_CATEGORY_NAME);
    expect(query.get('subcategory')).toBe('Grilled');
  });

  it('sends export_only only when the export rail is requested', () => {
    expect(buildInventoryItemsQuery({ page: 1 }).get('export_only')).toBeNull();
    expect(
      buildInventoryItemsQuery({ export_only: false }).get('export_only')
    ).toBeNull();
    expect(
      buildInventoryItemsQuery({ export_only: true }).get('export_only')
    ).toBe('true');
  });
});
