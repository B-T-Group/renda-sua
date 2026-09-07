export const SUPPORTED_COUNTRIES_CACHE_KEY = 'supported-countries';
export const SUPPORTED_COUNTRIES_TTL_SECONDS = 3600;
export const ESSENTIALS_TTL_SECONDS = 180;
export const STORES_TTL_SECONDS = 180;

export function isCatalogUserAuthenticated(
  userId: string | null | undefined
): boolean {
  return Boolean(userId && userId !== 'anonymous');
}

export function isInventoryItemsCacheable(input: {
  ownerPreview?: boolean;
  businessId?: string;
  hasOrigin: boolean;
  isAuthenticated: boolean;
}): boolean {
  return (
    !input.ownerPreview &&
    !input.businessId &&
    !input.hasOrigin &&
    !input.isAuthenticated
  );
}

export function inventoryItemsCacheTtlSeconds(
  search?: string,
  sort?: string
): number {
  if (search || sort === 'deals') return 30;
  if (!sort || sort === 'relevance') return 120;
  return 60;
}

export function storesActiveFilter(isActive?: string): string {
  if (isActive === 'true') return 'true';
  if (isActive === 'false') return 'false';
  return 'any';
}

export function buildStoresCacheKey(input: {
  hasOrigin: boolean;
  search?: string;
  countryCode?: string;
  state?: string;
  isActive?: string;
  includeUnavailable?: string;
  limit: number;
}): string | null {
  if (input.hasOrigin) return null;
  return [
    'stores',
    input.search || 'all',
    input.countryCode || 'global',
    input.state || 'all',
    storesActiveFilter(input.isActive),
    input.includeUnavailable === 'true' ? 'true' : 'false',
    input.limit,
  ].join(':');
}

export function buildEssentialsCacheKey(
  countryCode?: string,
  state?: string,
  limit?: number
): string {
  return ['essentials', countryCode || 'global', state || 'all', limit || 8].join(
    ':'
  );
}

export interface InventoryItemsCacheKeyInput {
  generation: number;
  page?: number;
  limit: number;
  sort?: string;
  search?: string;
  category?: string;
  subcategory?: string;
  locationName?: string;
  businessName?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  currency?: string;
  isActive?: boolean;
  countryCode?: string;
  state?: string;
  includeUnavailable?: boolean;
  businessLocationId?: string;
  collection?: string;
  foodOnly?: boolean;
}

function inventoryItemsFilterKeyParts(
  input: InventoryItemsCacheKeyInput
): Array<string | number> {
  return [
    input.search || '',
    input.category || '',
    input.subcategory || '',
    input.locationName || '',
    input.businessName || '',
    input.brand || '',
    input.minPrice || '',
    input.maxPrice || '',
    input.currency || '',
    input.isActive === false ? 'inactive' : 'active',
    input.countryCode || 'global',
    input.state || '',
    input.includeUnavailable ? 'incl' : 'avail',
    input.businessLocationId || '',
    input.collection || '',
    input.foodOnly ? 'food' : 'all',
  ];
}

export function buildInventoryItemsCacheKey(
  input: InventoryItemsCacheKeyInput
): string {
  return [
    'items',
    input.generation,
    input.page || 1,
    input.limit,
    input.sort || 'relevance',
    ...inventoryItemsFilterKeyParts(input),
  ].join(':');
}
