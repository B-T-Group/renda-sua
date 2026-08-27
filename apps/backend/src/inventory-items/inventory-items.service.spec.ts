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
