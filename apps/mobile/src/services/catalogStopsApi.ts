import type { CatalogInventoryItem } from '../types/inventoryCatalog';
import type { CollectionSummary } from '../types/collections';
import type { CatalogStore } from '../types/stores';
import { publicApiGet, publicApiPost } from './publicApiClient';

/**
 * Common query params for catalog stops endpoints.
 */
export interface CatalogStopsBaseParams {
  country_code?: string;
  state?: string;
  origin_lat?: number;
  origin_lng?: number;
  limit?: number;
}

/**
 * GET /catalog/stops/top-in-category
 */
export interface FetchTopInCategoryParams extends CatalogStopsBaseParams {
  category?: string;
  subcategory?: string;
}

export interface TopInCategoryStopEnvelope {
  success: boolean;
  data: {
    category_name: string;
    items: CatalogInventoryItem[];
  };
  message?: string;
}

export async function fetchTopInCategoryStop(
  params: FetchTopInCategoryParams,
  init?: { signal?: AbortSignal }
): Promise<TopInCategoryStopEnvelope> {
  const search = new URLSearchParams();
  if (params.category) search.set('category', params.category);
  if (params.subcategory) search.set('subcategory', params.subcategory);
  if (params.country_code) search.set('country_code', params.country_code);
  if (params.state) search.set('state', params.state);
  if (typeof params.origin_lat === 'number' && Number.isFinite(params.origin_lat)) {
    search.set('origin_lat', String(params.origin_lat));
  }
  if (typeof params.origin_lng === 'number' && Number.isFinite(params.origin_lng)) {
    search.set('origin_lng', String(params.origin_lng));
  }
  if (params.limit) search.set('limit', String(params.limit));

  const query = search.toString();
  const path = query ? `/catalog/stops/top-in-category?${query}` : '/catalog/stops/top-in-category';
  return publicApiGet<TopInCategoryStopEnvelope>(path, undefined, init);
}

/**
 * GET /catalog/stops/deals
 */
export interface DealsStopEnvelope {
  success: boolean;
  data: {
    items: CatalogInventoryItem[];
  };
  message?: string;
}

export async function fetchDealsStop(
  params: CatalogStopsBaseParams,
  init?: { signal?: AbortSignal }
): Promise<DealsStopEnvelope> {
  const search = new URLSearchParams();
  if (params.country_code) search.set('country_code', params.country_code);
  if (params.state) search.set('state', params.state);
  if (typeof params.origin_lat === 'number' && Number.isFinite(params.origin_lat)) {
    search.set('origin_lat', String(params.origin_lat));
  }
  if (typeof params.origin_lng === 'number' && Number.isFinite(params.origin_lng)) {
    search.set('origin_lng', String(params.origin_lng));
  }
  if (params.limit) search.set('limit', String(params.limit));

  const query = search.toString();
  const path = query ? `/catalog/stops/deals?${query}` : '/catalog/stops/deals';
  return publicApiGet<DealsStopEnvelope>(path, undefined, init);
}

/**
 * GET /catalog/stops/essentials
 */
export interface EssentialsStopEnvelope {
  success: boolean;
  data: {
    collections: CollectionSummary[];
  };
  message?: string;
}

export async function fetchEssentialsStop(
  params: CatalogStopsBaseParams,
  init?: { signal?: AbortSignal }
): Promise<EssentialsStopEnvelope> {
  const search = new URLSearchParams();
  if (params.country_code) search.set('country_code', params.country_code);
  if (params.state) search.set('state', params.state);
  if (typeof params.origin_lat === 'number' && Number.isFinite(params.origin_lat)) {
    search.set('origin_lat', String(params.origin_lat));
  }
  if (typeof params.origin_lng === 'number' && Number.isFinite(params.origin_lng)) {
    search.set('origin_lng', String(params.origin_lng));
  }
  if (params.limit) search.set('limit', String(params.limit));

  const query = search.toString();
  const path = query ? `/catalog/stops/essentials?${query}` : '/catalog/stops/essentials';
  return publicApiGet<EssentialsStopEnvelope>(path, undefined, init);
}

/**
 * GET /catalog/stops/featured-store
 */
export interface FeaturedStoreStopEnvelope {
  success: boolean;
  data: {
    stores: CatalogStore[];
  };
  message?: string;
}

export async function fetchFeaturedStoreStop(
  params: CatalogStopsBaseParams,
  init?: { signal?: AbortSignal }
): Promise<FeaturedStoreStopEnvelope> {
  const search = new URLSearchParams();
  if (params.country_code) search.set('country_code', params.country_code);
  if (params.state) search.set('state', params.state);
  if (typeof params.origin_lat === 'number' && Number.isFinite(params.origin_lat)) {
    search.set('origin_lat', String(params.origin_lat));
  }
  if (typeof params.origin_lng === 'number' && Number.isFinite(params.origin_lng)) {
    search.set('origin_lng', String(params.origin_lng));
  }
  if (params.limit) search.set('limit', String(params.limit));

  const query = search.toString();
  const path = query ? `/catalog/stops/featured-store?${query}` : '/catalog/stops/featured-store';
  return publicApiGet<FeaturedStoreStopEnvelope>(path, undefined, init);
}

/**
 * POST /catalog/stops/bag-complements
 */
export interface BagComplementsRequestBody {
  inventory_item_ids: string[];
}

export interface BagComplementsStopEnvelope {
  success: boolean;
  data: {
    items: Array<CatalogInventoryItem & { reason_label?: string }>;
  };
  message?: string;
}

export async function fetchBagComplementsStop(
  body: BagComplementsRequestBody,
  init?: { signal?: AbortSignal }
): Promise<BagComplementsStopEnvelope> {
  return publicApiPost<BagComplementsStopEnvelope>(
    '/catalog/stops/bag-complements',
    body,
    undefined,
    init
  );
}
