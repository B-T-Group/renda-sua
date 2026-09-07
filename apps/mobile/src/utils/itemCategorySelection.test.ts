import { describe, expect, it } from 'vitest';
import { itemCategoryIds, subsForCategory } from './itemCategorySelection';

describe('itemCategoryIds', () => {
  it('reads category and subcategory from nested item', () => {
    expect(
      itemCategoryIds({
        item_sub_category_id: 9,
        item_sub_category: {
          id: 9,
          item_category: { id: 3 },
        },
      })
    ).toEqual({ categoryId: 3, subCategoryId: 9 });
  });

  it('falls back to nested subcategory id', () => {
    expect(
      itemCategoryIds({
        item_sub_category: { id: 4, item_category: { id: 1 } },
      })
    ).toEqual({ categoryId: 1, subCategoryId: 4 });
  });

  it('returns nulls when unset', () => {
    expect(itemCategoryIds({})).toEqual({ categoryId: null, subCategoryId: null });
  });
});

describe('subsForCategory', () => {
  const categories = [
    {
      id: 1,
      name: 'Food',
      item_sub_categories: [{ id: 10, name: 'Soup', item_category_id: 1 }],
    },
    { id: 2, name: 'Other', item_sub_categories: [] },
  ];

  it('returns subs for the selected category', () => {
    expect(subsForCategory(categories, 1)).toHaveLength(1);
  });

  it('returns empty when no category is selected', () => {
    expect(subsForCategory(categories, null)).toEqual([]);
  });
});
