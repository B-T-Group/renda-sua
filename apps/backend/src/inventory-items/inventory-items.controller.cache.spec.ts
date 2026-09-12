import { CatalogCacheService } from '../catalog-cache/catalog-cache.service';
import {
  buildInventoryItemsCacheKey,
  buildStoresCacheKey,
  inventoryItemsCacheTtlSeconds,
  STORES_TTL_SECONDS,
} from '../catalog-cache/catalog-cache-keys';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { InventoryItemsController } from './inventory-items.controller';
import { InventoryItemsService } from './inventory-items.service';

describe('InventoryItemsController catalog cache gates', () => {
  let controller: InventoryItemsController;
  let catalogCache: {
    getOrCompute: jest.Mock;
    getGeneration: jest.Mock;
  };
  let inventoryItemsService: {
    getInventoryItems: jest.Mock;
    getTopInventoryStores: jest.Mock;
  };
  let hasuraUserService: { getUserId: jest.Mock };

  beforeEach(() => {
    catalogCache = {
      getOrCompute: jest.fn(async (_key: string, compute: () => Promise<unknown>) =>
        compute()
      ),
      getGeneration: jest.fn().mockResolvedValue(5),
    };
    inventoryItemsService = {
      getInventoryItems: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      getTopInventoryStores: jest.fn().mockResolvedValue([]),
    };
    hasuraUserService = {
      getUserId: jest.fn(() => {
        throw new Error('anonymous');
      }),
    };
    controller = new InventoryItemsController(
      inventoryItemsService as unknown as InventoryItemsService,
      catalogCache as unknown as CatalogCacheService,
      hasuraUserService as unknown as HasuraUserService
    );
  });

  it('caches anonymous public item listings with generation-scoped keys', async () => {
    await controller.getInventoryItems({
      country_code: 'CM',
      category: 'Electronics',
      sort: 'relevance',
    });

    expect(catalogCache.getOrCompute).toHaveBeenCalledWith(
      buildInventoryItemsCacheKey({
        generation: 5,
        limit: 20,
        sort: 'relevance',
        category: 'Electronics',
        countryCode: 'CM',
      }),
      expect.any(Function),
      { ttlSeconds: inventoryItemsCacheTtlSeconds(undefined, 'relevance') }
    );
  });

  it('skips the shared cache for owner preview, store scope, geo, and signed-in users', async () => {
    await controller.getInventoryItems({ owner_preview: 'true' });
    await controller.getInventoryItems({ business_id: 'biz-1' });
    await controller.getInventoryItems({
      origin_lat: '4.05',
      origin_lng: '9.70',
    });
    hasuraUserService.getUserId.mockReturnValue('user-1');
    await controller.getInventoryItems({ country_code: 'CM' });

    expect(catalogCache.getOrCompute).not.toHaveBeenCalled();
    expect(inventoryItemsService.getInventoryItems).toHaveBeenCalledTimes(4);
  });

  it('uses a distinct cache key for export-only catalog listings', async () => {
    await controller.getInventoryItems({
      country_code: 'CA',
      export_only: 'true',
    });

    expect(catalogCache.getOrCompute).toHaveBeenCalledWith(
      buildInventoryItemsCacheKey({
        generation: 5,
        limit: 20,
        countryCode: 'CA',
        exportOnly: true,
      }),
      expect.any(Function),
      { ttlSeconds: inventoryItemsCacheTtlSeconds(undefined, undefined) }
    );
  });

  it('still caches anonymous traffic when Hasura reports the anonymous sentinel', async () => {
    hasuraUserService.getUserId.mockReturnValue('anonymous');

    await controller.getInventoryItems({ country_code: 'CM' });

    expect(catalogCache.getOrCompute).toHaveBeenCalledTimes(1);
  });

  it('skips the store rail cache when the request is origin-specific', async () => {
    await controller.getTopInventoryStores(
      '20',
      undefined,
      'CM',
      'Littoral',
      'true',
      undefined,
      '4.05',
      '9.70'
    );

    expect(catalogCache.getOrCompute).not.toHaveBeenCalled();
    expect(inventoryItemsService.getTopInventoryStores).toHaveBeenCalledWith(
      20,
      expect.objectContaining({ origin_lat: 4.05, origin_lng: 9.7 })
    );
  });

  it('caches the public store rail without origin', async () => {
    await controller.getTopInventoryStores(
      '20',
      undefined,
      'CM',
      'Littoral',
      'true',
      'false'
    );

    expect(catalogCache.getOrCompute).toHaveBeenCalledWith(
      buildStoresCacheKey({
        hasOrigin: false,
        countryCode: 'CM',
        state: 'Littoral',
        isActive: 'true',
        includeUnavailable: 'false',
        limit: 20,
      }),
      expect.any(Function),
      { ttlSeconds: STORES_TTL_SECONDS }
    );
  });
});
