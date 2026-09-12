jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));
jest.mock('../addresses/addresses.service', () => ({
  AddressesService: class AddressesService {},
}));
jest.mock('../merchant-lifecycle/merchant-lifecycle.service', () => ({
  MerchantLifecycleService: class MerchantLifecycleService {},
}));

import { InventoryItemsService } from './inventory-items.service';
import { FOOD_CATEGORY_NAME } from '../food/food.constants';

describe('InventoryItemsService.buildInventoryCatalogWhere', () => {
  function createService(options?: {
    validateLocationSupport?: boolean;
    supportedCountries?: string[];
  }) {
    const hasuraSystemService = {
      executeQuery: jest.fn().mockImplementation(async (query: string) => {
        if (query.includes('ValidateLocationSupport')) {
          return {
            supported_country_states: options?.validateLocationSupport === false ? [] : [{ id: '1' }],
          };
        }
        if (query.includes('GetSupportedCountryCodes')) {
          return {
            supported_country_states: (options?.supportedCountries ?? ['CA', 'CM']).map(
              (country_code) => ({ country_code })
            ),
          };
        }
        if (query.includes('StripeCountries')) {
          return {
            supported_payment_systems: [{ country: 'CA' }],
          };
        }
        return {};
      }),
    };

    const service = new InventoryItemsService(
      hasuraSystemService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );

    return {
      service,
      buildWhere: (params: Record<string, unknown>) =>
        (service as any).buildInventoryCatalogWhere({
          is_active: true,
          include_unavailable: false,
          ...params,
        }),
      whereJson: (result: { where: Record<string, unknown> }) =>
        JSON.stringify(result.where),
    };
  }

  function hasCountryEq(whereJson: string, country: string): boolean {
    return whereJson.includes(`"country":{"_eq":"${country}"}`);
  }

  it('skips caller geo when business_location_id is set', async () => {
    const { buildWhere, whereJson } = createService();
    const built = await buildWhere({
      business_location_id: 'loc-cm-1',
      country_code: 'CA',
      state: 'Ontario',
    });

    expect(built).toHaveProperty('where');
    const json = whereJson(built as { where: Record<string, unknown> });
    expect(json).toContain('"business_location_id":{"_eq":"loc-cm-1"}');
    expect(hasCountryEq(json, 'CA')).toBe(false);
    expect(json).not.toContain('"state":{"_eq":"Ontario"}');
  });

  it('applies caller geo when browsing without business_location_id', async () => {
    const { buildWhere, whereJson } = createService();
    const built = await buildWhere({
      country_code: 'CA',
      state: 'Ontario',
    });

    expect(built).toHaveProperty('where');
    const json = whereJson(built as { where: Record<string, unknown> });
    expect(hasCountryEq(json, 'CA')).toBe(true);
    expect(json).toContain('"state":{"_eq":"Ontario"}');
  });

  it('skips caller geo for owner preview even without business_location_id', async () => {
    const { buildWhere, whereJson } = createService();
    const built = await buildWhere({
      country_code: 'CA',
      ownerPreview: true,
    });

    expect(built).toHaveProperty('where');
    const json = whereJson(built as { where: Record<string, unknown> });
    expect(hasCountryEq(json, 'CA')).toBe(false);
  });

  it('uses lexical name/sku/brand match when searchTextQuery is set', async () => {
    const { buildWhere, whereJson } = createService();
    const built = await buildWhere({ searchTextQuery: 'phone' });

    expect(built).toHaveProperty('where');
    const json = whereJson(built as { where: Record<string, unknown> });
    expect(json).toContain('"_ilike":"%phone%"');
    expect(json).toContain('"name"');
    expect(json).toContain('"sku"');
    expect(json).toContain('"_in":["CA","CM"]');
  });

  it('excludes export listings from the default local catalog', async () => {
    const { buildWhere, whereJson } = createService();
    const built = await buildWhere({ country_code: 'CA', state: 'Ontario' });

    expect(built).toHaveProperty('where');
    const json = whereJson(built as { where: Record<string, unknown> });
    expect(json).toContain('"export_available":{"_eq":false}');
    expect(json).not.toContain('"export_markets"');
  });

  it('returns unsupported when export-only is requested without a viewer country', async () => {
    const { buildWhere } = createService();
    await expect(buildWhere({ export_only: true })).resolves.toEqual({
      unsupported: true,
    });
  });

  it('returns unsupported when the export-only destination market is not onboarded', async () => {
    const { buildWhere } = createService({ validateLocationSupport: false });
    await expect(
      buildWhere({ export_only: true, country_code: 'XX' })
    ).resolves.toEqual({ unsupported: true });
  });

  it('scopes export-only listings to export_available items for the viewer market', async () => {
    const { buildWhere, whereJson } = createService();
    const built = await buildWhere({
      export_only: true,
      country_code: 'ca',
      state: 'Ontario',
    });

    expect(built).toHaveProperty('where');
    const json = whereJson(built as { where: Record<string, unknown> });
    expect(json).toContain('"export_available":{"_eq":true}');
    expect(json).toContain('"export_markets":{"country_code":{"_eq":"CA"}}');
    expect(hasCountryEq(json, 'CA')).toBe(false);
    expect(json).not.toContain('"state":{"_eq":"Ontario"}');
  });

  it('includes matching export listings in search without dropping local stock', async () => {
    const { buildWhere, whereJson } = createService();
    const built = await buildWhere({
      includeExportInSearch: true,
      country_code: 'ca',
      state: 'Ontario',
    });

    expect(built).toHaveProperty('where');
    const json = whereJson(built as { where: Record<string, unknown> });
    expect(json).toContain('"_or"');
    expect(json).toContain('"export_available":{"_eq":false}');
    expect(json).toContain('"export_available":{"_eq":true}');
    expect(json).toContain('"export_markets":{"country_code":{"_eq":"CA"}}');
    expect(json).toContain('"state":{"_eq":"Ontario"}');
  });

  it('does not apply the default export exclude on store or wishlist rails', async () => {
    const { buildWhere, whereJson } = createService();
    const built = await buildWhere({
      includeExportListings: true,
      country_code: 'CA',
    });

    expect(built).toHaveProperty('where');
    const json = whereJson(built as { where: Record<string, unknown> });
    expect(json).not.toContain('"export_available":{"_eq":false}');
    expect(json).not.toContain('"export_markets"');
  });
});

describe('InventoryItemsService.resolveSemanticSearch', () => {
  it('falls back instead of throwing when embeddings fail', async () => {
    const itemEmbeddingService = {
      normalizeSearchQuery: (q: string) => q.trim(),
      isEmbeddingsSearchEnabled: () => true,
      embedSearchQuery: jest.fn().mockRejectedValue(new Error('OpenAI down')),
      hasAnyItemEmbeddings: jest.fn().mockResolvedValue(true),
    };
    const service = new InventoryItemsService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      itemEmbeddingService as any,
      {} as any
    );

    const result = await (service as any).resolveSemanticSearch('phone');
    expect(result).toEqual({ fallback: true });
  });

  it('falls back to lexical search when no catalog embeddings exist', async () => {
    const itemEmbeddingService = {
      normalizeSearchQuery: (q: string) => q.trim(),
      isEmbeddingsSearchEnabled: () => true,
      hasAnyItemEmbeddings: jest.fn().mockResolvedValue(false),
      embedSearchQuery: jest.fn(),
    };
    const service = new InventoryItemsService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      itemEmbeddingService as any,
      {} as any
    );

    const result = await (service as any).resolveSemanticSearch('phone');
    expect(result).toEqual({ fallback: true });
    expect(itemEmbeddingService.embedSearchQuery).not.toHaveBeenCalled();
  });

  it('uses lexical search when embeddings search is disabled', async () => {
    const itemEmbeddingService = {
      normalizeSearchQuery: (q: string) => q.trim(),
      isEmbeddingsSearchEnabled: () => false,
      hasAnyItemEmbeddings: jest.fn(),
      embedSearchQuery: jest.fn(),
    };
    const service = new InventoryItemsService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      itemEmbeddingService as any,
      {} as any
    );

    const result = await (service as any).resolveSemanticSearch('phone');
    expect(result).toEqual({ fallback: true });
    expect(itemEmbeddingService.hasAnyItemEmbeddings).not.toHaveBeenCalled();
  });
});

describe('InventoryItemsService food catalog helpers', () => {
  function createService() {
    const hasuraSystemService = {
      executeQuery: jest.fn().mockImplementation(async (query: string) => {
        if (query.includes('GetSupportedCountryCodes')) {
          return {
            supported_country_states: [{ country_code: 'CM' }],
          };
        }
        return {};
      }),
    };
    const service = new InventoryItemsService(
      hasuraSystemService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );
    return {
      service,
      buildWhere: (params: Record<string, unknown>) =>
        (service as any).buildInventoryCatalogWhere({
          is_active: true,
          include_unavailable: false,
          ...params,
        }),
    };
  }

  function foodRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'inv-food',
      item: {
        item_sub_category: { item_category: { name: FOOD_CATEGORY_NAME } },
      },
      business_location: { address: { country: 'CM' } },
      food_settings: [
        {
          marked_unavailable_at: null,
          availability_slots: [
            { day_of_week: 1, start_time: '12:30:00', end_time: '16:00:00' },
          ],
        },
      ],
      ...overrides,
    };
  }

  it('adds an exact cooked-food category filter when food_only is set', async () => {
    const { buildWhere } = createService();
    const built = await buildWhere({ food_only: true });

    expect(built).toHaveProperty('where');
    const json = JSON.stringify(
      (built as { where: Record<string, unknown> }).where
    );
    expect(json).toContain(`"name":{"_eq":"${FOOD_CATEGORY_NAME}"}`);
  });

  it('does not pin cooked food when food_only is off', async () => {
    const { buildWhere } = createService();
    const built = await buildWhere({ food_only: false });
    const json = JSON.stringify(
      (built as { where: Record<string, unknown> }).where
    );

    expect(json).not.toContain(`"name":{"_eq":"${FOOD_CATEGORY_NAME}"}`);
  });

  it('attaches availability only to cooked-food rows', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-24T12:00:00.000Z'));
    const { service } = createService();
    const electronics = {
      id: 'inv-retail',
      item: {
        item_sub_category: { item_category: { name: 'Electronics' } },
      },
    };

    const [food, retail] = (service as any).attachFoodAvailability([
      foodRow(),
      electronics,
    ]);

    expect(food.food_availability?.is_available_now).toBe(true);
    expect(retail.food_availability).toBeUndefined();
    jest.useRealTimers();
  });

  it('ranks dishes being served now ahead of closed or sold-out rows', () => {
    const { service } = createService();
    const closed = {
      id: 'closed',
      food_availability: { is_available_now: false },
    };
    const open = {
      id: 'open',
      food_availability: { is_available_now: true },
    };
    const soldOut = {
      id: 'sold-out',
      food_availability: { is_available_now: false },
    };

    const actual = (service as any).sortOpenFoodFirst([closed, open, soldOut]);

    expect(actual.map((row: { id: string }) => row.id)).toEqual([
      'open',
      'closed',
      'sold-out',
    ]);
  });
});

describe('InventoryItemsService.clampInventoryListLimit', () => {
  it('defaults and caps public catalog page size', () => {
    const service = new InventoryItemsService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );
    const clamp = (limit?: number) =>
      (service as any).clampInventoryListLimit(limit);

    expect(clamp(undefined)).toBe(20);
    expect(clamp(0)).toBe(20);
    expect(clamp(12)).toBe(12);
    expect(clamp(200)).toBe(50);
  });
});

describe('InventoryItemsService.getInventoryItems export flags', () => {
  function createService() {
    const hasuraUser = {
      getUser: jest.fn().mockRejectedValue(new Error('anonymous')),
    };
    const itemEmbeddingService = {
      normalizeSearchQuery: (q: string) => q.trim(),
      isEmbeddingsSearchEnabled: () => false,
    };
    const service = new InventoryItemsService(
      {} as any,
      hasuraUser as any,
      {} as any,
      {} as any,
      {} as any,
      itemEmbeddingService as any,
      {} as any
    );
    const buildWhere = jest
      .spyOn(service as any, 'buildInventoryCatalogWhere')
      .mockResolvedValue({ where: { _and: [] } });
    jest
      .spyOn(service as any, 'countDistinctCatalogItemIds')
      .mockResolvedValue(0);
    return { service, buildWhere };
  }

  it('wires export_only, search, and store rails to the catalog where-builder', async () => {
    const { service, buildWhere } = createService();

    await service.getInventoryItems({
      export_only: true,
      country_code: 'CA',
    });
    await service.getInventoryItems({
      search: 'phone',
      country_code: 'CA',
    });
    await service.getInventoryItems({
      business_location_id: 'loc-1',
      country_code: 'CA',
    });

    expect(buildWhere.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        export_only: true,
        includeExportInSearch: false,
        includeExportListings: false,
      })
    );
    expect(buildWhere.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        export_only: false,
        includeExportInSearch: true,
        includeExportListings: false,
        searchTextQuery: 'phone',
      })
    );
    expect(buildWhere.mock.calls[2][0]).toEqual(
      expect.objectContaining({
        includeExportListings: true,
        export_only: false,
        includeExportInSearch: false,
      })
    );
  });
});

describe('InventoryItemsService.getSimilarInventoryItems', () => {
  it('keeps similar suggestions in the same export vs local catalog', async () => {
    let similarWhere: Record<string, unknown> | undefined;
    const hasuraSystemService = {
      executeQuery: jest.fn().mockImplementation(async (query: string, vars: any) => {
        if (query.includes('GetItemTags')) {
          return {
            business_inventory_by_pk: {
              item_id: 'item-1',
              item: {
                export_available: true,
                item_tags: [{ tag_id: 'tag-1' }],
              },
            },
          };
        }
        if (query.includes('GetSimilarInventoryItems')) {
          similarWhere = vars.where;
          return { business_inventory: [] };
        }
        if (query.includes('StripeCountries')) {
          return { supported_payment_systems: [{ country: 'CA' }] };
        }
        return {};
      }),
    };
    const service = new InventoryItemsService(
      hasuraSystemService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );

    await service.getSimilarInventoryItems('inv-1');

    expect(JSON.stringify(similarWhere)).toContain(
      '"export_available":{"_eq":true}'
    );
  });
});

describe('InventoryItemsService.getInventoryItemById', () => {
  it('rethrows unexpected errors as 500 and keeps the original cause', async () => {
    const cause = new Error('graphql validation failed');
    const service = new InventoryItemsService(
      { executeQuery: jest.fn().mockRejectedValue(cause) } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );

    await expect(
      service.getInventoryItemById('11111111-1111-1111-1111-111111111111')
    ).rejects.toMatchObject({
      message: 'Failed to fetch inventory item',
      cause,
    });
  });
});
