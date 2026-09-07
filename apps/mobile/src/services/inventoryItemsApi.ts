import type {
  InventoryItemByIdEnvelope,
  InventoryItemsApiEnvelope,
  InventorySortMode,
} from '../types/inventoryCatalog';
import type { CatalogStoreEnvelope, CatalogStoresEnvelope } from '../types/stores';
import { FOOD_CATEGORY_NAME } from '../utils/foodAvailability';
import { apiRequest } from './apiClient';
import { publicApiGet } from './publicApiClient';

export interface FetchInventoryItemsParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  subcategory?: string;
  business_name?: string;
  business_id?: string;
  business_location_id?: string;
  brand?: string;
  collection?: string;
  sort?: InventorySortMode;
  is_active?: boolean;
  include_unavailable?: boolean;
  owner_preview?: boolean;
  country_code?: string;
  state?: string;
  origin_lat?: number;
  origin_lng?: number;
  /** Restrict the list to cooked food sold by restaurants (the Food tab). */
  food_only?: boolean;
}

export interface FetchCatalogStoresParams {
  limit?: number;
  search?: string;
  country_code?: string;
  state?: string;
  origin_lat?: number;
  origin_lng?: number;
  include_unavailable?: boolean;
  owner_preview?: boolean;
}

/** Exported for tests — Food-tab queries must pin the cooked-food category. */
export function buildInventoryItemsQuery(
  params: FetchInventoryItemsParams
): URLSearchParams {
  const search = new URLSearchParams();
  search.set('page', String(params.page ?? 1));
  search.set('limit', String(params.limit ?? 25));
  search.set('is_active', String(params.is_active !== false));
  const category =
    params.category?.trim() ||
    (params.food_only === true ? FOOD_CATEGORY_NAME : undefined);
  if (params.search) search.set('search', params.search);
  if (category) search.set('category', category);
  if (params.subcategory) search.set('subcategory', params.subcategory);
  if (params.business_name) search.set('business_name', params.business_name);
  if (params.business_id) search.set('business_id', params.business_id);
  if (params.business_location_id) {
    search.set('business_location_id', params.business_location_id);
  }
  if (params.brand) search.set('brand', params.brand);
  if (params.collection) search.set('collection', params.collection);
  if (params.food_only === true) search.set('food_only', 'true');
  if (params.sort) search.set('sort', params.sort);
  if (params.include_unavailable === true) search.set('include_unavailable', 'true');
  if (params.owner_preview === true) search.set('owner_preview', 'true');
  if (params.country_code) search.set('country_code', params.country_code);
  if (params.state) search.set('state', params.state);
  if (typeof params.origin_lat === 'number' && Number.isFinite(params.origin_lat)) {
    search.set('origin_lat', String(params.origin_lat));
  }
  if (typeof params.origin_lng === 'number' && Number.isFinite(params.origin_lng)) {
    search.set('origin_lng', String(params.origin_lng));
  }
  return search;
}

function inventoryItemsListPath(params: FetchInventoryItemsParams): string {
  const q = buildInventoryItemsQuery(params).toString();
  return q ? `/inventory-items?${q}` : '/inventory-items';
}

export async function fetchPublicInventoryItems(
  params: FetchInventoryItemsParams,
  init?: { signal?: AbortSignal }
): Promise<InventoryItemsApiEnvelope> {
  return publicApiGet<InventoryItemsApiEnvelope>(inventoryItemsListPath(params), undefined, init);
}

export async function fetchAuthenticatedInventoryItems(
  params: FetchInventoryItemsParams,
  init?: { signal?: AbortSignal }
): Promise<InventoryItemsApiEnvelope> {
  return apiRequest<InventoryItemsApiEnvelope>(inventoryItemsListPath(params), {
    method: 'GET',
    signal: init?.signal,
  });
}

export async function fetchPublicInventoryItemById(
  id: string,
  init?: { signal?: AbortSignal }
): Promise<InventoryItemByIdEnvelope> {
  const path = `/inventory-items/${encodeURIComponent(id)}`;
  return publicApiGet<InventoryItemByIdEnvelope>(path, undefined, init);
}

export async function fetchAuthenticatedInventoryItemById(
  id: string,
  init?: { signal?: AbortSignal }
): Promise<InventoryItemByIdEnvelope> {
  const path = `/inventory-items/${encodeURIComponent(id)}`;
  return apiRequest<InventoryItemByIdEnvelope>(path, { method: 'GET', signal: init?.signal });
}

function catalogStoresPath(params: FetchCatalogStoresParams): string {
  const search = new URLSearchParams();
  search.set('limit', String(params.limit ?? 20));
  if (params.search?.trim()) search.set('search', params.search.trim());
  if (params.country_code) search.set('country_code', params.country_code);
  if (params.state) search.set('state', params.state);
  if (params.include_unavailable === true) search.set('include_unavailable', 'true');
  if (typeof params.origin_lat === 'number' && Number.isFinite(params.origin_lat)) {
    search.set('origin_lat', String(params.origin_lat));
  }
  if (typeof params.origin_lng === 'number' && Number.isFinite(params.origin_lng)) {
    search.set('origin_lng', String(params.origin_lng));
  }
  const q = search.toString();
  return q ? `/inventory-items/stores?${q}` : '/inventory-items/stores';
}

export async function fetchPublicCatalogStores(
  params: FetchCatalogStoresParams,
  init?: { signal?: AbortSignal }
): Promise<CatalogStoresEnvelope> {
  return publicApiGet<CatalogStoresEnvelope>(catalogStoresPath(params), undefined, init);
}

export async function fetchAuthenticatedCatalogStores(
  params: FetchCatalogStoresParams,
  init?: { signal?: AbortSignal }
): Promise<CatalogStoresEnvelope> {
  return apiRequest<CatalogStoresEnvelope>(catalogStoresPath(params), {
    method: 'GET',
    signal: init?.signal,
  });
}

export async function fetchPublicCatalogStoreById(
  locationOrBusinessId: string,
  params?: Omit<FetchCatalogStoresParams, 'limit' | 'search'>,
  init?: { signal?: AbortSignal }
): Promise<CatalogStoreEnvelope> {
  const search = new URLSearchParams();
  if (params?.country_code) search.set('country_code', params.country_code);
  if (params?.include_unavailable === true) search.set('include_unavailable', 'true');
  if (params?.owner_preview === true) search.set('owner_preview', 'true');
  if (typeof params?.origin_lat === 'number' && Number.isFinite(params.origin_lat)) {
    search.set('origin_lat', String(params.origin_lat));
  }
  if (typeof params?.origin_lng === 'number' && Number.isFinite(params.origin_lng)) {
    search.set('origin_lng', String(params.origin_lng));
  }
  const q = search.toString();
  const path = `/inventory-items/stores/${encodeURIComponent(locationOrBusinessId)}${q ? `?${q}` : ''}`;
  return publicApiGet<CatalogStoreEnvelope>(path, undefined, init);
}

export async function fetchAuthenticatedCatalogStoreById(
  locationOrBusinessId: string,
  params?: Omit<FetchCatalogStoresParams, 'limit' | 'search'>,
  init?: { signal?: AbortSignal }
): Promise<CatalogStoreEnvelope> {
  const search = new URLSearchParams();
  if (params?.country_code) search.set('country_code', params.country_code);
  if (params?.include_unavailable === true) search.set('include_unavailable', 'true');
  if (params?.owner_preview === true) search.set('owner_preview', 'true');
  if (typeof params?.origin_lat === 'number' && Number.isFinite(params.origin_lat)) {
    search.set('origin_lat', String(params.origin_lat));
  }
  if (typeof params?.origin_lng === 'number' && Number.isFinite(params.origin_lng)) {
    search.set('origin_lng', String(params.origin_lng));
  }
  const q = search.toString();
  const path = `/inventory-items/stores/${encodeURIComponent(locationOrBusinessId)}${q ? `?${q}` : ''}`;
  return apiRequest<CatalogStoreEnvelope>(path, { method: 'GET', signal: init?.signal });
}

export type StockAvailabilityStatus = 'pending' | 'confirmed' | 'adjusted' | 'unavailable';

export interface StockAvailabilityCheckData {
  messageId: string;
  status: StockAvailabilityStatus;
  inventoryId: string;
  itemId: string;
  itemName: string;
  itemImageUrl: string | null;
  locationName: string | null;
  businessName: string | null;
  quantityAtRequest: number;
  currentQuantity: number;
  currentAvailable: number;
  clientName: string;
  quantityAfterResponse?: number;
  respondedAt?: string;
}

export async function requestStockAvailabilityCheck(
  inventoryId: string
): Promise<{ success: boolean; messageId: string }> {
  return apiRequest(`/inventory-items/${encodeURIComponent(inventoryId)}/availability-check`, {
    method: 'POST',
  });
}

export async function fetchStockAvailabilityCheck(
  messageId: string,
  headerOverrides?: Record<string, string>
): Promise<{ success: boolean; data: StockAvailabilityCheckData }> {
  return apiRequest(
    `/inventory-items/availability-checks/${encodeURIComponent(messageId)}`,
    { method: 'GET' },
    headerOverrides
  );
}

export async function respondStockAvailabilityCheck(
  messageId: string,
  body: { action: 'confirm' | 'unavailable' | 'adjust'; quantity?: number },
  headerOverrides?: Record<string, string>
): Promise<{ success: boolean; data: StockAvailabilityCheckData }> {
  return apiRequest(
    `/inventory-items/availability-checks/${encodeURIComponent(messageId)}/respond`,
    { method: 'POST', body: JSON.stringify(body) },
    headerOverrides
  );
}
