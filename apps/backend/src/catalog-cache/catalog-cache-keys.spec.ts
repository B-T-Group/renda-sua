import {
  buildEssentialsCacheKey,
  buildInventoryItemsCacheKey,
  buildStoresCacheKey,
  inventoryItemsCacheTtlSeconds,
  isCatalogUserAuthenticated,
  isInventoryItemsCacheable,
  storesActiveFilter,
} from './catalog-cache-keys';

describe('isCatalogUserAuthenticated', () => {
  it('treats missing and anonymous ids as public catalog traffic', () => {
    expect(isCatalogUserAuthenticated(undefined)).toBe(false);
    expect(isCatalogUserAuthenticated(null)).toBe(false);
    expect(isCatalogUserAuthenticated('')).toBe(false);
    expect(isCatalogUserAuthenticated('anonymous')).toBe(false);
  });

  it('treats a real user id as authenticated', () => {
    expect(isCatalogUserAuthenticated('user-1')).toBe(true);
  });
});

describe('isInventoryItemsCacheable', () => {
  const cacheable = {
    ownerPreview: false,
    businessId: undefined,
    hasOrigin: false,
    isAuthenticated: false,
  };

  it('allows anonymous public catalog queries', () => {
    expect(isInventoryItemsCacheable(cacheable)).toBe(true);
  });

  it('skips cache for owner preview, store-scoped, geo, and signed-in traffic', () => {
    expect(isInventoryItemsCacheable({ ...cacheable, ownerPreview: true })).toBe(
      false
    );
    expect(isInventoryItemsCacheable({ ...cacheable, businessId: 'biz-1' })).toBe(
      false
    );
    expect(isInventoryItemsCacheable({ ...cacheable, hasOrigin: true })).toBe(
      false
    );
    expect(
      isInventoryItemsCacheable({ ...cacheable, isAuthenticated: true })
    ).toBe(false);
  });
});

describe('inventoryItemsCacheTtlSeconds', () => {
  it('uses a short TTL for search and deals', () => {
    expect(inventoryItemsCacheTtlSeconds('laptop', 'relevance')).toBe(30);
    expect(inventoryItemsCacheTtlSeconds(undefined, 'deals')).toBe(30);
  });

  it('uses a longer TTL for default relevance and a mid TTL for other sorts', () => {
    expect(inventoryItemsCacheTtlSeconds(undefined, undefined)).toBe(120);
    expect(inventoryItemsCacheTtlSeconds(undefined, 'relevance')).toBe(120);
    expect(inventoryItemsCacheTtlSeconds(undefined, 'fastest')).toBe(60);
    expect(inventoryItemsCacheTtlSeconds(undefined, 'cheapest')).toBe(60);
  });
});

describe('buildStoresCacheKey', () => {
  it('returns null when the request is origin-specific', () => {
    expect(
      buildStoresCacheKey({
        hasOrigin: true,
        countryCode: 'CM',
        limit: 20,
      })
    ).toBeNull();
  });

  it('scopes store rails by country, state, activity, and availability', () => {
    expect(
      buildStoresCacheKey({
        hasOrigin: false,
        search: 'market',
        countryCode: 'CM',
        state: 'Littoral',
        isActive: 'true',
        includeUnavailable: 'false',
        limit: 20,
      })
    ).toBe('stores:market:CM:Littoral:true:false:20');
  });

  it('defaults unset filters so public rails share a stable key', () => {
    expect(buildStoresCacheKey({ hasOrigin: false, limit: 20 })).toBe(
      'stores:all:global:all:any:false:20'
    );
    expect(storesActiveFilter(undefined)).toBe('any');
    expect(storesActiveFilter('false')).toBe('false');
  });
});

describe('buildEssentialsCacheKey', () => {
  it('defaults to a global 8-item essentials rail', () => {
    expect(buildEssentialsCacheKey()).toBe('essentials:global:all:8');
  });

  it('isolates essentials by country and state', () => {
    expect(buildEssentialsCacheKey('CM', 'Littoral', 8)).toBe(
      'essentials:CM:Littoral:8'
    );
  });
});

describe('buildInventoryItemsCacheKey', () => {
  it('includes generation so catalog writes can bust stale pages', () => {
    const key = buildInventoryItemsCacheKey({
      generation: 5,
      page: 1,
      limit: 20,
      sort: 'relevance',
      category: 'Electronics',
      countryCode: 'CM',
    });
    expect(key).toContain('items:5:1:20:relevance');
    expect(key).toContain(':Electronics:');
    expect(key).toContain(':CM:');
  });

  it('keeps inactive, unavailable, and food-only listings on separate keys', () => {
    const inactive = buildInventoryItemsCacheKey({
      generation: 1,
      limit: 20,
      isActive: false,
      includeUnavailable: true,
      foodOnly: true,
    });
    expect(inactive).toContain(':inactive:');
    expect(inactive).toContain(':incl:');
    expect(inactive).toContain(':food:');
    expect(inactive.endsWith(':local')).toBe(true);
  });

  it('does not collapse omitted is_active into the inactive key', () => {
    const omitted = buildInventoryItemsCacheKey({ generation: 1, limit: 20 });
    expect(omitted).toContain(':active:');
    expect(omitted).not.toContain(':inactive:');
  });

  it('isolates export-only listings from the local catalog cache', () => {
    const local = buildInventoryItemsCacheKey({
      generation: 1,
      limit: 20,
      countryCode: 'CA',
    });
    const exported = buildInventoryItemsCacheKey({
      generation: 1,
      limit: 20,
      countryCode: 'CA',
      exportOnly: true,
    });

    expect(local.endsWith(':local')).toBe(true);
    expect(exported.endsWith(':export')).toBe(true);
    expect(local).not.toEqual(exported);
  });
});
