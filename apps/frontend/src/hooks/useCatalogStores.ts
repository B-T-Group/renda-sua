import { useAuth0 } from '@auth0/auth0-react';
import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';
import { DETECTED_COUNTRY_STORAGE_KEY } from './useDetectedCountry';
import { useSupportedCountries } from './useSupportedCountries';
import type { PublicBrowserGeo } from './usePublicBrowserGeo';

export interface CatalogStore {
  business_location_id: string;
  business_id: string;
  name: string;
  city?: string | null;
  logo_url: string | null;
  item_count: number;
  is_verified: boolean;
  can_accept_orders: boolean;
  is_storefront_visible: boolean;
  distance_meters?: number | null;
}

export function useCatalogStores(options: {
  limit?: number;
  search?: string;
  include_unavailable?: boolean;
  anonymousOrigin?: PublicBrowserGeo | null;
  enabled?: boolean;
}) {
  const { isAuthenticated } = useAuth0();
  const { supportedIsos } = useSupportedCountries();
  const api = useApiClient();
  const [stores, setStores] = useState<CatalogStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const limit = options.limit ?? 12;
  const search = options.search?.trim() || undefined;
  const includeUnavailable = options.include_unavailable ?? false;
  const anonymousOrigin = options.anonymousOrigin;
  const enabled = options.enabled !== false;

  const fetchStores = useCallback(async () => {
    if (!enabled) {
      setStores([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    let country_code: string | undefined;
    if (!isAuthenticated) {
      const detected =
        typeof window !== 'undefined'
          ? localStorage.getItem(DETECTED_COUNTRY_STORAGE_KEY)
          : null;
      const code = detected?.toUpperCase();
      if (code && supportedIsos.includes(code)) {
        country_code = code;
      }
    }
    try {
      const { data } = await api.get<{
        success: boolean;
        data: { stores: CatalogStore[] };
        message?: string;
      }>('/inventory-items/stores', {
        params: {
          limit,
          ...(search && { search }),
          ...(country_code && { country_code }),
          include_unavailable: includeUnavailable,
          ...(anonymousOrigin && {
            origin_lat: anonymousOrigin.lat,
            origin_lng: anonymousOrigin.lng,
          }),
        },
      });
      if (!data.success) {
        setStores([]);
        setError(data.message || 'Failed to load stores');
        return;
      }
      setStores(data.data?.stores ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load stores');
      setStores([]);
    } finally {
      setLoading(false);
    }
  }, [
    api,
    enabled,
    isAuthenticated,
    supportedIsos,
    limit,
    search,
    includeUnavailable,
    anonymousOrigin,
  ]);

  useEffect(() => {
    void fetchStores();
  }, [fetchStores]);

  return { stores, loading, error, refetch: fetchStores };
}

export function useCatalogStore(
  locationOrBusinessId: string | undefined,
  options: {
    include_unavailable?: boolean;
    owner_preview?: boolean;
    anonymousOrigin?: PublicBrowserGeo | null;
    enabled?: boolean;
  } = {}
) {
  const { isAuthenticated } = useAuth0();
  const { supportedIsos } = useSupportedCountries();
  const api = useApiClient();
  const [store, setStore] = useState<CatalogStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const includeUnavailable = options.include_unavailable ?? false;
  const ownerPreview = options.owner_preview === true;
  const anonymousOrigin = options.anonymousOrigin;
  const enabled =
    options.enabled !== false && Boolean(locationOrBusinessId?.trim());

  const fetchStore = useCallback(async () => {
    if (!enabled || !locationOrBusinessId?.trim()) {
      setStore(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    let country_code: string | undefined;
    if (!isAuthenticated) {
      const detected =
        typeof window !== 'undefined'
          ? localStorage.getItem(DETECTED_COUNTRY_STORAGE_KEY)
          : null;
      const code = detected?.toUpperCase();
      if (code && supportedIsos.includes(code)) {
        country_code = code;
      }
    }
    try {
      const { data } = await api.get<{
        success: boolean;
        data: { store: CatalogStore };
        message?: string;
      }>(
        `/inventory-items/stores/${encodeURIComponent(locationOrBusinessId.trim())}`,
        {
          params: {
            ...(country_code && { country_code }),
            include_unavailable: includeUnavailable,
            ...(ownerPreview && { owner_preview: true }),
            ...(anonymousOrigin && {
              origin_lat: anonymousOrigin.lat,
              origin_lng: anonymousOrigin.lng,
            }),
          },
        }
      );
      if (!data.success) {
        setStore(null);
        setError(data.message || 'Store not found');
        return;
      }
      setStore(data.data?.store ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load store');
      setStore(null);
    } finally {
      setLoading(false);
    }
  }, [
    api,
    enabled,
    locationOrBusinessId,
    isAuthenticated,
    supportedIsos,
    includeUnavailable,
    ownerPreview,
    anonymousOrigin,
  ]);

  useEffect(() => {
    setStore(null);
    void fetchStore();
  }, [fetchStore]);

  return { store, loading, error, refetch: fetchStore };
}
