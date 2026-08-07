import {
  availabilityForInventoryRow,
  buildFacebookCatalogCsvFromInventories,
  buildFacebookCatalogRowsFromInventories,
  combinedProductTagLabels,
  csvEscape,
  distributeTagsEvenlyAcrossColumns,
  type FeedInventoryRow,
} from './facebook-catalog-csv.util';

function sampleInventory(
  overrides: Partial<FeedInventoryRow> = {}
): FeedInventoryRow {
  return {
    id: 'inv-1',
    selling_price: 1500,
    computed_available_quantity: 3,
    is_active: true,
    business_location: {
      name: 'Douala Store',
      business: { name: 'Acme Co' },
    },
    item: {
      name: 'Blue Shirt',
      description: 'A nice shirt, cotton',
      price: 2000,
      currency: 'XAF',
      is_used: false,
      brand: { name: 'Acme' },
      item_images: [
        {
          image_url: '/uploads/shirt.jpg',
          image_type: 'main',
          display_order: 0,
        },
      ],
      item_tags: [{ tag: { name: 'apparel' } }, { tag: { name: 'cotton' } }],
      item_sub_category: {
        google_product_category: 212,
        fb_product_category: 123,
        google_product_category_row: {
          id: 212,
          name_en: 'Apparel & Accessories',
          name_fr: 'Vêtements',
        },
        fb_product_category_row: {
          id: 123,
          name_en: 'Clothing',
          name_fr: 'Vêtements',
        },
      },
    },
    ...overrides,
  };
}

describe('facebook-catalog-csv.util', () => {
  it('escapes commas and quotes', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape('plain')).toBe('plain');
  });

  it('marks inactive or zero-qty as out of stock', () => {
    expect(
      availabilityForInventoryRow({ is_active: false, computed_available_quantity: 5 })
    ).toBe('out of stock');
    expect(
      availabilityForInventoryRow({ is_active: true, computed_available_quantity: 0 })
    ).toBe('out of stock');
    expect(
      availabilityForInventoryRow({ is_active: true, computed_available_quantity: 2 })
    ).toBe('in stock');
  });

  it('distributes tags evenly across columns', () => {
    expect(distributeTagsEvenlyAcrossColumns(['a', 'b', 'c'], 2)).toEqual([
      'a, b',
      'c',
    ]);
    expect(distributeTagsEvenlyAcrossColumns([], 3)).toEqual(['', '', '']);
  });

  it('combines item tags then location name', () => {
    expect(combinedProductTagLabels(sampleInventory())).toEqual([
      'apparel',
      'cotton',
      'Douala Store',
    ]);
  });

  it('builds a catalog row with absolute links and category ids', () => {
    const { rows } = buildFacebookCatalogRowsFromInventories({
      inventories: [sampleInventory()],
      webOrigin: 'https://rendasua.com',
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('inv-1');
    expect(rows[0].title).toBe('Blue Shirt');
    expect(rows[0].price).toBe('1500 XAF');
    expect(rows[0].quantity_to_sell_on_facebook).toBe('3');
    expect(rows[0].link).toBe('https://rendasua.com/items/inv-1');
    expect(rows[0].image_link).toBe('https://rendasua.com/uploads/shirt.jpg');
    expect(rows[0].brand).toBe('Acme');
    expect(rows[0].google_product_category).toBe('212');
    expect(rows[0].fb_product_category).toBe('123');
    expect(rows[0].availability).toBe('in stock');
    expect(rows[0].condition).toBe('new');
  });

  it('uses item currency and caps quantity to available stock', () => {
    const { rows } = buildFacebookCatalogRowsFromInventories({
      inventories: [
        sampleInventory({
          selling_price: 25.5,
          computed_available_quantity: 2,
          item: {
            ...sampleInventory().item!,
            currency: 'CAD',
          },
        }),
      ],
      webOrigin: 'https://rendasua.com',
    });
    expect(rows[0].price).toBe('25.5 CAD');
    expect(rows[0].quantity_to_sell_on_facebook).toBe('2');
  });

  it('uses image_url (full asset), not display_url/thumbnail', () => {
    const { rows } = buildFacebookCatalogRowsFromInventories({
      inventories: [
        sampleInventory({
          item: {
            ...sampleInventory().item!,
            item_images: [
              {
                image_url: '/uploads/full-primary.jpg',
                display_url: '/uploads/thumb-primary.webp',
                image_type: 'main',
                display_order: 0,
              },
            ],
          },
        }),
      ],
      webOrigin: 'https://rendasua.com',
    });
    expect(rows[0].image_link).toBe(
      'https://rendasua.com/uploads/full-primary.jpg'
    );
  });

  it('uses variant images when parent item_images are empty', () => {
    const { rows } = buildFacebookCatalogRowsFromInventories({
      inventories: [
        sampleInventory({
          item_variant_id: 'var-1',
          item_variant: {
            item_variant_images: [
              {
                image_url: '/uploads/variant.jpg',
                is_primary: true,
                display_order: 0,
              },
            ],
          },
          item: {
            ...sampleInventory().item!,
            item_images: [],
          },
        }),
      ],
      webOrigin: 'https://rendasua.com',
    });
    expect(rows[0].image_link).toBe('https://rendasua.com/uploads/variant.jpg');
  });

  it('falls back to taxonomy path when category ids are missing', () => {
    const inv = sampleInventory({
      item: {
        ...sampleInventory().item!,
        item_sub_category: {
          google_product_category: null,
          fb_product_category: null,
          google_product_category_row: {
            id: 1,
            name_en: 'Apparel & Accessories',
            name_fr: 'Vêtements',
          },
          fb_product_category_row: {
            id: 2,
            name_en: 'Clothing',
            name_fr: 'Vêtements',
          },
        },
      },
    });
    const { rows } = buildFacebookCatalogRowsFromInventories({
      inventories: [inv],
      webOrigin: 'https://rendasua.com',
      productCategoryLanguage: 'en',
    });
    expect(rows[0].google_product_category).toBe('Apparel & Accessories');
    expect(rows[0].fb_product_category).toBe('Clothing');
  });

  it('builds CSV with header and data line', () => {
    const { csv, rowCount } = buildFacebookCatalogCsvFromInventories({
      inventories: [sampleInventory()],
      webOrigin: 'https://rendasua.com',
    });
    expect(rowCount).toBe(1);
    expect(csv.startsWith('id,title,description,')).toBe(true);
    expect(csv).toContain('inv-1');
    expect(csv).toContain('Blue Shirt');
  });

  it('keeps out-of-stock rows in the feed with quantity 0', () => {
    const { rows } = buildFacebookCatalogRowsFromInventories({
      inventories: [
        sampleInventory({ computed_available_quantity: 0 }),
      ],
      webOrigin: 'https://rendasua.com',
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].availability).toBe('out of stock');
    expect(rows[0].quantity_to_sell_on_facebook).toBe('0');
  });
});
