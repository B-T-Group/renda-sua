import { useCallback, useEffect, useRef, useState } from 'react';
import { ImageType } from '../types/image';
import type { FoodAvailability } from '../types/food';
import type {
  ItemVariant,
  VariantPriceOverride,
} from '../types/itemVariant';
import { useAuth0 } from '@auth0/auth0-react';
import { useApiClient } from './useApiClient';
import {
  catalogGeoQueryParams,
  useCatalogGeoParams,
} from './useCatalogGeoParams';
import { FOOD_CATEGORY_NAME, isFoodCatalogItem } from '../constants/food';

export interface InventoryItem {
  id: string;
  business_location_id: string;
  item_id: string;
  computed_available_quantity: number;
  selling_price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  promotion?: {
    promoted?: boolean;
    start?: string;
    end?: string;
    sponsored?: boolean;
  } | null;
  viewsCount?: number;
  likes_count?: number;
  liked?: boolean;
  hasActiveDeal?: boolean;
  original_price?: number;
  discounted_price?: number;
  deal_discount_type?: 'percentage' | 'fixed';
  deal_discount_value?: number;
  deal_end_at?: string;
  /** False when MoMo location phone is missing or unverified. */
  payments_enabled?: boolean;
  distance_text?: string;
  duration_text?: string;
  distance_value?: number;
  avg_rating?: number | null;
  rating_count?: number | null;
  /** Location-specific variant price overrides (shared stock). */
  variant_price_overrides?: VariantPriceOverride[];
  /** Present only for items in the cooked-food category. */
  food_availability?: FoodAvailability | null;
  item: {
    id: string;
    name: string;
    description: string;
    interest_only?: boolean;
    price: number;
    currency: string;
    weight: number;
    weight_unit: string;
    dimensions?: string | null;
    item_sub_category_id: number;
    sku: string;
    brand: {
      id: string;
      name: string;
    };
    model: string;
    color: string;
    is_fragile: boolean;
    is_perishable: boolean;
    is_used: boolean;
    requires_special_handling: boolean;
    max_delivery_distance: number;
    estimated_delivery_time: number;
    /** Typical minutes to cook the dish (cooked food only). */
    preparation_minutes?: number | null;
    min_order_quantity: number;
    max_order_quantity: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    item_sub_category: {
      id: number;
      name: string;
      google_product_category?: string | number | null;
      google_product_category_row?: {
        id: string | number;
        name_en?: string | null;
        name_fr?: string | null;
      } | null;
      fb_product_category?: number | null;
      fb_product_category_row?: {
        id: number;
        name_en?: string | null;
        name_fr?: string | null;
      } | null;
      item_category: {
        id: number;
        name: string;
      };
    };
    item_images: Array<{
      id: string;
      image_url: string;
      image_type: ImageType;
      alt_text?: string;
      caption?: string;
      display_order: number;
      thumbnail?: string | null;
      thumbnail_status?: string | null;
      display_url?: string | null;
    }>;
    tags?: Array<{ id: string; name: string }>;
    collections?: Array<{ id: string; slug: string; name: string }>;
    item_variants?: ItemVariant[];
  };
  business_location: {
    id: string;
    business_id: string;
    name: string;
    location_type: string;
    is_primary: boolean;
    logo_url?: string | null;
    business: {
      id: string;
      name: string;
      is_verified: boolean;
      is_storefront_visible?: boolean;
      can_accept_orders?: boolean;
    };
    address: {
      id: string;
      address_line_1: string;
      address_line_2?: string;
      city: string;
      state: string;
      postal_code: string;
      country: string;
    };
  };
}

export type InventorySortMode =
  | 'relevance'
  | 'fastest'
  | 'cheapest'
  | 'top_rated'
  | 'deals';

export interface GetInventoryItemsQuery {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  subcategory?: string;
  business_name?: string;
  brand?: string;
  min_price?: number;
  max_price?: number;
  currency?: string;
  is_active?: boolean;
  country_code?: string;
  state?: string;
  sort?: InventorySortMode;
  include_unavailable?: boolean;
  business_location_id?: string;
  business_id?: string;
  /** Explicit merchant preview (requires verified owner JWT). */
  owner_preview?: boolean;
  anonymousOrigin?: { lat: number; lng: number } | null;
  collection?: string;
  /** Restrict the list to cooked food sold by restaurants (the Food tab). */
  food_only?: boolean;
  /** When false, skip fetching (e.g. wait for store header). */
  enabled?: boolean;
}

export interface PaginatedInventoryItems {
  items: InventoryItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse {
  success: boolean;
  data: PaginatedInventoryItems;
  message: string;
}

function isLocationScopedCatalogQuery(query: GetInventoryItemsQuery): boolean {
  return Boolean(
    query.owner_preview ||
      query.business_location_id?.trim() ||
      query.business_id?.trim()
  );
}

export const useInventoryItems = (query: GetInventoryItemsQuery = {}) => {
  const { isAuthenticated } = useAuth0();
  const catalogGeo = useCatalogGeoParams();
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<{
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  } | null>(null);

  const apiClient = useApiClient();
  const abortControllerRef = useRef<AbortController | null>(null);
  const listScopeRef = useRef<string>('');
  const locationScoped = isLocationScopedCatalogQuery(query);
  const marketReady = locationScoped || catalogGeo.ready;

  const listScopeKey = [
    query.search ?? '',
    query.category ?? '',
    query.subcategory ?? '',
    query.business_name ?? '',
    query.brand ?? '',
    query.min_price ?? '',
    query.max_price ?? '',
    query.currency ?? '',
    query.sort ?? '',
    query.include_unavailable ?? '',
    query.business_location_id ?? '',
    query.business_id ?? '',
    query.owner_preview ?? '',
    query.collection ?? '',
    query.is_active ?? '',
    query.food_only ?? '',
    locationScoped ? '' : `${catalogGeo.country_code ?? ''}:${catalogGeo.state ?? ''}`,
  ].join('|');

  const fetchInventoryItems = useCallback(async () => {
    if (query.enabled === false) {
      setInventoryItems([]);
      setPagination(null);
      setLoading(false);
      setLoadingMore(false);
      setError(null);
      return;
    }

    if (!marketReady) {
      setLoading(true);
      return;
    }

    // Cancel any in-flight request so it cannot overwrite results from this request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const scopeChanged = listScopeRef.current !== listScopeKey;
    listScopeRef.current = listScopeKey;
    const requestedPage = query.page || 1;
    // Filter/sort/location changes can race ahead of page reset; always replace then.
    const page = scopeChanged ? 1 : requestedPage;
    const isLoadMore = page > 1 && !scopeChanged;
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setLoadingMore(false);
    }
    setError(null);

    const geoParams = locationScoped
      ? {}
      : catalogGeoQueryParams(catalogGeo);
    const country_code = query.country_code ?? geoParams.country_code;
    const state = query.state ?? geoParams.state;

    try {
      const response = await apiClient.get<ApiResponse>('/inventory-items', {
        params: {
          page,
          limit: query.limit || 20,
          is_active: query.is_active !== undefined ? query.is_active : true,
          ...(query.search && { search: query.search }),
          ...(query.category && { category: query.category }),
          ...(query.food_only === true &&
            !query.category && { category: FOOD_CATEGORY_NAME }),
          ...(query.subcategory && { subcategory: query.subcategory }),
          ...(query.business_name && { business_name: query.business_name }),
          ...(query.brand && { brand: query.brand }),
          ...(query.min_price && { min_price: query.min_price }),
          ...(query.max_price && { max_price: query.max_price }),
          ...(query.currency && { currency: query.currency }),
          ...(country_code ? { country_code } : {}),
          ...(state ? { state } : {}),
          ...(query.sort && { sort: query.sort }),
          ...(query.include_unavailable !== undefined && {
            include_unavailable: query.include_unavailable,
          }),
          ...(query.business_location_id?.trim() && {
            business_location_id: query.business_location_id.trim(),
          }),
          ...(query.business_id?.trim() && {
            business_id: query.business_id.trim(),
          }),
          ...(query.owner_preview === true && { owner_preview: true }),
          ...(query.collection?.trim() && {
            collection: query.collection.trim(),
          }),
          ...(query.food_only === true && { food_only: true }),
          ...(!isAuthenticated &&
            query.anonymousOrigin && {
              origin_lat: query.anonymousOrigin.lat,
              origin_lng: query.anonymousOrigin.lng,
            }),
        },
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      if (response.data.success) {
        const rawItems = response.data.data.items;
        const nextItems =
          query.food_only === true
            ? rawItems.filter(isFoodCatalogItem)
            : rawItems;
        const leakedNonFood =
          query.food_only === true && nextItems.length !== rawItems.length;
        if (isLoadMore) {
          setInventoryItems((prev) => {
            const seen = new Set(prev.map((item) => item.id));
            const appended = nextItems.filter((item) => !seen.has(item.id));
            return appended.length > 0 ? [...prev, ...appended] : prev;
          });
        } else {
          setInventoryItems(nextItems);
        }
        setPagination({
          total: leakedNonFood ? nextItems.length : response.data.data.total,
          page: response.data.data.page,
          limit: response.data.data.limit,
          totalPages: leakedNonFood ? 1 : response.data.data.totalPages,
        });
      } else {
        setError(response.data.message || 'Failed to fetch inventory items');
      }
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      const isAborted =
        (err as { name?: string })?.name === 'Canceled' ||
        (err as { name?: string })?.name === 'AbortError';
      if (isAborted) return;

      const errorMessage =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ||
        (err as { message?: string })?.message ||
        'Failed to fetch inventory items';
      setError(errorMessage);
      console.error('Error fetching inventory items:', err);
    } finally {
      if (!controller.signal.aborted) {
        if (isLoadMore) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [
    isAuthenticated,
    marketReady,
    locationScoped,
    catalogGeo.country_code,
    catalogGeo.state,
    listScopeKey,
    query.page,
    query.limit,
    query.is_active,
    query.search,
    query.category,
    query.subcategory,
    query.business_name,
    query.brand,
    query.min_price,
    query.max_price,
    query.currency,
    query.sort,
    query.include_unavailable,
    query.business_location_id,
    query.business_id,
    query.owner_preview,
    query.collection,
    query.enabled,
    query.anonymousOrigin?.lat,
    query.anonymousOrigin?.lng,
    query.country_code,
    query.state,
  ]);

  useEffect(() => {
    fetchInventoryItems();
  }, [fetchInventoryItems]);

  const refetch = useCallback(() => {
    fetchInventoryItems();
  }, [fetchInventoryItems]);

  return {
    inventoryItems,
    loading,
    loadingMore,
    error,
    pagination,
    refetch,
  };
};
