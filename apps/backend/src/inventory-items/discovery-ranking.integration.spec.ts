jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));
jest.mock('../addresses/addresses.service', () => ({
  AddressesService: class AddressesService {},
}));
jest.mock('../merchant-lifecycle/merchant-lifecycle.service', () => ({
  MerchantLifecycleService: class MerchantLifecycleService {},
}));

import { CatalogCacheService } from '../catalog-cache/catalog-cache.service';
import { buildInventoryItemsCacheKey } from '../catalog-cache/catalog-cache-keys';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { DiscoveryRecoveryService } from './discovery/discovery-recovery.service';
import { DiscoverySignalsService } from './discovery/discovery-signals.service';
import { InventoryItemsController } from './inventory-items.controller';
import { InventoryItemsService, type InventoryItem } from './inventory-items.service';

const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
function row(item_id: string, over: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: `inv-${item_id}-${over.id ?? ''}`,
    business_location_id: 'loc',
    item_id,
    computed_available_quantity: 3,
    selling_price: 10,
    is_active: true,
    created_at: day(40),
    updated_at: day(40),
    ...over,
  } as InventoryItem;
}

describe('InventoryItemsService.rankForDiscovery', () => {
  function make(popularity: Record<string, { d30: number; d90: number }> = {}) {
    const signals = {
      getPopularity: jest.fn().mockResolvedValue(new Map(Object.entries(popularity))),
    } as unknown as DiscoverySignalsService;
    const service = new InventoryItemsService(
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, undefined, signals
    );
    const empty = {
      orderedInventoryIds: new Set<string>(),
      orderedItemIds: new Set<string>(),
      orderedBrandIds: new Set<string>(),
      orderedCategoryIds: new Set<number>(),
    };
    return {
      signals,
      rank: (items: InventoryItem[], mode: any, semanticScores?: Map<string, number>) =>
        (service as any).rankForDiscovery({
          items, mode, clientId: null, relevanceSignals: empty, semanticScores, country: 'CM',
        }) as Promise<InventoryItem[]>,
    };
  }

  it('popular: in-market 30-day demand, in stock first, one row per item', async () => {
    const { rank, signals } = make({ hot: { d30: 9, d90: 9 }, warm: { d30: 3, d90: 10 }, soldout: { d30: 50, d90: 50 } });
    const out = await rank(
      [
        row('warm'),
        row('hot', { id: 'a' }),
        row('hot', { id: 'b', computed_available_quantity: 0 }), // sold-out duplicate listing dropped
        row('soldout', { computed_available_quantity: 0 }),
        row('cold'),
      ],
      'popular'
    );
    expect(out.map((i) => i.item_id)).toEqual(['hot', 'warm', 'cold', 'soldout']);
    expect((signals.getPopularity as jest.Mock)).toHaveBeenCalledWith('CM');
  });

  it('does not read popularity for other modes (no extra load)', async () => {
    const { rank, signals } = make();
    await rank([row('a'), row('b')], 'newest');
    await rank([row('a'), row('b')], 'rating');
    await rank([row('a'), row('b')], 'recommended');
    expect(signals.getPopularity as jest.Mock).not.toHaveBeenCalled();
  });

  it('relevance keeps semantic order but moves sold-out items to the end', async () => {
    const { rank } = make();
    const scores = new Map([['sold', 0.99], ['mid', 0.6], ['low', 0.4]]);
    const out = await rank(
      [row('low'), row('sold', { computed_available_quantity: 0 }), row('mid')],
      'relevance',
      scores
    );
    expect(out.map((i) => i.item_id)).toEqual(['mid', 'low', 'sold']);
  });

  it('recommended blends the rating signal (weight 1) and still puts stock first', async () => {
    const { rank } = make();
    const out = await rank(
      [
        row('plain'),
        row('rated', { avg_rating: 4.9, rating_count: 30 }),
        row('rated-soldout', { avg_rating: 5, rating_count: 90, computed_available_quantity: 0 }),
      ],
      'recommended'
    );
    expect(out.map((i) => i.item_id)).toEqual(['rated', 'plain', 'rated-soldout']);
  });
});

describe('InventoryItemsController discovery flag', () => {
  function make(flag: boolean | 'absent') {
    const catalogCache = {
      getOrCompute: jest.fn(async (_k: string, compute: () => Promise<unknown>) => compute()),
      getGeneration: jest.fn().mockResolvedValue(7),
    };
    const items = {
      getInventoryItems: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 }),
    };
    const hasura = { getUserId: jest.fn(() => { throw new Error('anon'); }) };
    const recovery =
      flag === 'absent'
        ? undefined
        : ({ flagEnabled: jest.fn().mockResolvedValue(flag) } as unknown as DiscoveryRecoveryService);
    const controller = new InventoryItemsController(
      items as unknown as InventoryItemsService,
      catalogCache as unknown as CatalogCacheService,
      hasura as unknown as HasuraUserService,
      recovery
    );
    return { controller, items, catalogCache, recovery };
  }

  it.each([false, 'absent'] as const)(
    'flag %s: new sort values are ignored and the query + cache key are exactly the old ones',
    async (flag) => {
      const { controller, items, catalogCache } = make(flag);
      await controller.getInventoryItems({ country_code: 'CM', sort: 'popular' });
      await controller.getInventoryItems({ country_code: 'CM', search: 'rice' });
      for (const call of items.getInventoryItems.mock.calls) {
        expect(call[0]).not.toHaveProperty('discovery');
        expect(call[0].sort).toBeUndefined();
      }
      expect(catalogCache.getOrCompute.mock.calls[0][0]).toBe(
        buildInventoryItemsCacheKey({ generation: 7, limit: 20, countryCode: 'CM' })
      );
    }
  );

  it('flag on: browse defaults to recommended, search to relevance, explicit modes pass through', async () => {
    const { controller, items } = make(true);
    await controller.getInventoryItems({ country_code: 'CM' });
    await controller.getInventoryItems({ country_code: 'CM', search: 'rice' });
    await controller.getInventoryItems({ country_code: 'CM', search: 'rice', sort: 'rating' });
    await controller.getInventoryItems({ country_code: 'CM', sort: 'cheapest' });
    const calls = items.getInventoryItems.mock.calls.map((c) => c[0]);
    expect(calls[0].discovery).toEqual({ sort: 'recommended' });
    expect(calls[1].discovery).toEqual({ sort: 'relevance' });
    expect(calls[2].discovery).toEqual({ sort: 'rating' });
    expect(calls[3].discovery).toBeUndefined(); // legacy sort untouched
    expect(calls[3].sort).toBe('cheapest');
  });

  it('flag on: cache keys never collide with flag-off entries or between modes', async () => {
    const { controller, catalogCache } = make(true);
    await controller.getInventoryItems({ country_code: 'CM' });
    await controller.getInventoryItems({ country_code: 'CM', sort: 'popular' });
    const keys = catalogCache.getOrCompute.mock.calls.map((c) => c[0]);
    const flagOffKey = buildInventoryItemsCacheKey({ generation: 7, limit: 20, countryCode: 'CM' });
    expect(new Set([...keys, flagOffKey]).size).toBe(3);
  });

  it('flag is looked up with the request country (country row first)', async () => {
    const { controller, recovery } = make(true);
    await controller.getInventoryItems({ country_code: 'GA' });
    expect((recovery as any).flagEnabled).toHaveBeenCalledWith('GA');
  });
});
