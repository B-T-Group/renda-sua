import { FOOD_CATEGORY_NAME } from '../../food/food.constants';
import type { InventoryItem } from '../../inventory-items/inventory-items.service';
import type { CatalogExperienceContext } from '../catalog-experience.types';
import { RecentlyViewedProvider } from './recently-viewed.provider';

function listing(
  overrides: Partial<InventoryItem> & {
    item?: Partial<InventoryItem['item']> & {
      item_sub_category?: {
        item_category?: { name?: string };
      };
      export_available?: boolean;
      export_markets?: Array<{ country_code: string }>;
    };
  } = {}
): InventoryItem {
  const { item, ...rest } = overrides;
  return {
    id: rest.id ?? 'inv-1',
    item_id: rest.item_id ?? 'item-1',
    selling_price: 10,
    item: {
      id: item?.id ?? rest.item_id ?? 'item-1',
      name: item?.name ?? 'Sample',
      export_available: item?.export_available ?? false,
      export_markets: item?.export_markets ?? [],
      item_sub_category: item?.item_sub_category,
      ...item,
    },
    ...rest,
  } as InventoryItem;
}

function context(
  overrides: Partial<CatalogExperienceContext> = {}
): CatalogExperienceContext {
  return {
    userId: 'user-1',
    language: 'en',
    layout: 'discovery',
    isReturning: true,
    surface: 'all',
    country: 'CM',
    ...overrides,
  };
}

describe('RecentlyViewedProvider surface filter', () => {
  function createProvider(listings: InventoryItem[]) {
    const hasura = {
      executeQuery: jest.fn().mockResolvedValue({
        item_view_events: listings.map((row) => ({
          business_inventory: { item_id: row.item_id },
        })),
      }),
    };
    const inventory = {
      getBestListingsForCatalogItemIds: jest.fn().mockResolvedValue(listings),
    };
    return {
      provider: new RecentlyViewedProvider(hasura as any, inventory as any),
      inventory,
    };
  }

  it('keeps only cooked food on the food surface', async () => {
    const { provider } = createProvider([
      listing({
        id: 'food-1',
        item_id: 'food-item',
        item: {
          name: 'Jollof',
          item_sub_category: {
            item_category: { name: FOOD_CATEGORY_NAME },
          },
        },
      }),
      listing({
        id: 'retail-1',
        item_id: 'retail-item',
        item: { name: 'Phone' },
      }),
    ]);

    const module = await provider.build(context({ surface: 'food' }));
    expect(module?.products.map((p) => p.id)).toEqual(['food-1']);
  });

  it('keeps only market export listings on the export surface', async () => {
    const { provider } = createProvider([
      listing({
        id: 'export-cm',
        item_id: 'export-item',
        item: {
          name: 'Tea',
          export_available: true,
          export_markets: [{ country_code: 'CM' }],
        },
      }),
      listing({
        id: 'export-other',
        item_id: 'export-other-item',
        item: {
          name: 'Coffee',
          export_available: true,
          export_markets: [{ country_code: 'TG' }],
        },
      }),
      listing({
        id: 'local-1',
        item_id: 'local-item',
        item: { name: 'Local', export_available: false },
      }),
    ]);

    const module = await provider.build(context({ surface: 'export' }));
    expect(module?.products.map((p) => p.id)).toEqual(['export-cm']);
  });

  it('hides the rail on rentals and when a surface has no matches', async () => {
    const { provider } = createProvider([
      listing({
        id: 'local-1',
        item_id: 'local-item',
        item: { name: 'Local', export_available: false },
      }),
    ]);

    await expect(
      provider.build(context({ surface: 'rentals' }))
    ).resolves.toBeNull();
    await expect(
      provider.build(context({ surface: 'export' }))
    ).resolves.toBeNull();
  });

  it('keeps a padded cooked-food name and drops a near miss', async () => {
    const { provider } = createProvider([
      listing({
        id: 'padded',
        item_id: 'padded-item',
        item: {
          name: 'Jollof',
          item_sub_category: { item_category: { name: '  Restaurant & Cooked Food  ' } },
        },
      }),
      listing({
        id: 'near',
        item_id: 'near-item',
        item: {
          name: 'Snack',
          item_sub_category: { item_category: { name: 'Restaurant' } },
        },
      }),
    ]);

    const module = await provider.build(context({ surface: 'food' }));
    expect(module?.products.map((row) => row.id)).toEqual(['padded']);
  });

  it('matches an export market in any case, and keeps every export when the country is blank', async () => {
    const rows = [
      listing({
        id: 'cm',
        item_id: 'cm-item',
        item: { name: 'Tea', export_available: true, export_markets: [{ country_code: ' cm ' }] },
      }),
      listing({
        id: 'tg',
        item_id: 'tg-item',
        item: { name: 'Coffee', export_available: true, export_markets: [{ country_code: 'TG' }] },
      }),
      listing({
        id: 'empty-markets',
        item_id: 'empty-item',
        item: { name: 'Cocoa', export_available: true, export_markets: [] },
      }),
      listing({
        id: 'local',
        item_id: 'local-item',
        item: { name: 'Local', export_available: false },
      }),
    ];
    const { provider } = createProvider(rows);
    const scoped = await provider.build(context({ surface: 'export', country: 'CM' }));
    expect(scoped?.products.map((row) => row.id)).toEqual(['cm']);
    const open = await provider.build(context({ surface: 'export', country: '  ' }));
    expect(open?.products.map((row) => row.id)).toEqual(['cm', 'tg', 'empty-markets']);
  });

  it('asks for each viewed item once and skips a row with no item', async () => {
    const hasura = {
      executeQuery: jest.fn().mockResolvedValue({
        item_view_events: [
          { business_inventory: { item_id: 'a' } },
          { business_inventory: null },
          { business_inventory: { item_id: 'a' } },
          { business_inventory: { item_id: 'b' } },
        ],
      }),
    };
    const inventory = {
      getBestListingsForCatalogItemIds: jest.fn().mockResolvedValue([
        listing({ id: 'la', item_id: 'a' }),
        listing({ id: 'lb', item_id: 'b' }),
      ]),
    };
    const provider = new RecentlyViewedProvider(hasura as any, inventory as any);
    const module = await provider.build(context({ surface: 'all' }));
    expect(inventory.getBestListingsForCatalogItemIds).toHaveBeenCalledWith(['a', 'b']);
    expect(module?.products.map((row) => row.id)).toEqual(['la', 'lb']);
  });
});
