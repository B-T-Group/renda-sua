import {
  formatCatalogForVisionPrompt,
  matchItemCategoryNames,
  remapImageItemSuggestionCategories,
  type ItemCategoryTreeNode,
} from './match-item-category';

const tree: ItemCategoryTreeNode[] = [
  {
    id: 1,
    name: 'Food & Beverages',
    item_sub_categories: [
      { id: 11, name: 'Snacks', item_category_id: 1 },
      { id: 12, name: 'Beverages', item_category_id: 1 },
    ],
  },
  {
    id: 2,
    name: 'Health & Beauty',
    item_sub_categories: [
      { id: 21, name: 'Skincare', item_category_id: 2 },
    ],
  },
  {
    id: 3,
    name: 'Retail & Shopping',
    item_sub_categories: [
      { id: 31, name: 'Smartphones', item_category_id: 3 },
      { id: 32, name: 'Accessories', item_category_id: 3 },
    ],
  },
];

describe('matchItemCategoryNames', () => {
  it('matches an exact category and subcategory pair case-insensitively', () => {
    const actual = matchItemCategoryNames(tree, 'food & beverages', 'snacks');

    expect(actual).toEqual({
      categoryId: 1,
      subCategoryId: 11,
      categoryName: 'Food & Beverages',
      subCategoryName: 'Snacks',
      matchedCategory: true,
      matchedSubCategory: true,
    });
  });

  it('fuzzy-matches a short category label to an existing category', () => {
    const actual = matchItemCategoryNames(tree, 'Food', 'Snacks');

    expect(actual.categoryId).toBe(1);
    expect(actual.subCategoryId).toBe(11);
    expect(actual.matchedCategory).toBe(true);
    expect(actual.matchedSubCategory).toBe(true);
  });

  it('keeps subcategories under the matched merchant category', () => {
    const actual = matchItemCategoryNames(tree, 'Health & Beauty', 'Snacks');

    expect(actual.categoryId).toBe(2);
    expect(actual.subCategoryId).toBeNull();
    expect(actual.categoryName).toBe('Health & Beauty');
    expect(actual.subCategoryName).toBe('Snacks');
    expect(actual.matchedCategory).toBe(true);
    expect(actual.matchedSubCategory).toBe(false);
  });

  it('uses a global subcategory match when the category is unknown', () => {
    const actual = matchItemCategoryNames(tree, 'Electronics', 'Smartphones');

    expect(actual.categoryId).toBe(3);
    expect(actual.subCategoryId).toBe(31);
    expect(actual.categoryName).toBe('Retail & Shopping');
    expect(actual.subCategoryName).toBe('Smartphones');
  });

  it('does not use a global subcategory match when disabled for merchant input', () => {
    const actual = matchItemCategoryNames(tree, 'Electronics', 'Smartphones', {
      allowGlobalSubMatch: false,
    });

    expect(actual.matchedCategory).toBe(false);
    expect(actual.matchedSubCategory).toBe(false);
    expect(actual.categoryId).toBeNull();
    expect(actual.subCategoryId).toBeNull();
  });

  it('reuses a matched category when the subcategory is new', () => {
    const actual = matchItemCategoryNames(
      tree,
      'Health & Beauty',
      'Hair Care'
    );

    expect(actual).toEqual({
      categoryId: 2,
      subCategoryId: null,
      categoryName: 'Health & Beauty',
      subCategoryName: 'Hair Care',
      matchedCategory: true,
      matchedSubCategory: false,
    });
  });

  it('returns unmatched when neither category nor subcategory is close', () => {
    const actual = matchItemCategoryNames(tree, 'Industrial', 'Heavy Machinery');

    expect(actual.matchedCategory).toBe(false);
    expect(actual.matchedSubCategory).toBe(false);
    expect(actual.categoryId).toBeNull();
    expect(actual.subCategoryId).toBeNull();
  });
});

describe('formatCatalogForVisionPrompt', () => {
  it('formats categories with subcategories for the vision prompt', () => {
    const actual = formatCatalogForVisionPrompt(tree);

    expect(actual).toContain('Food & Beverages: Snacks, Beverages');
    expect(actual).toContain('Retail & Shopping: Smartphones, Accessories');
  });
});

describe('remapImageItemSuggestionCategories', () => {
  it('rewrites AI labels to catalog names and preserves originals as alternates', () => {
    const actual = remapImageItemSuggestionCategories(
      {
        categoryName: 'Food',
        subCategoryName: 'Snacks',
        categoryAlternates: ['Groceries'],
      },
      tree
    );

    expect(actual.categoryName).toBe('Food & Beverages');
    expect(actual.subCategoryName).toBe('Snacks');
    expect(actual.categoryAlternates).toEqual(['Food', 'Groceries']);
  });
});
