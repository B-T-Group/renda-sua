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
});
