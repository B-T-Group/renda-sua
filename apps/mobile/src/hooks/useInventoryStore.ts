import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchAuthenticatedCatalogStoreById,
  fetchPublicCatalogStoreById,
} from '../services/inventoryItemsApi';
import type { CatalogStore } from '../types/stores';

export interface UseInventoryStoreOptions {
  /** Location id, or business id (resolves to primary location). */
  businessId: string;
  countryCode?: string;
  origin?: { lat: number; lng: number } | null;
  withAuth?: boolean;
  /** Owner preview: include unavailable / hidden storefront when authenticated as owner. */
  previewMode?: boolean;
  enabled?: boolean;
}

export function useInventoryStore({
  businessId,
  countryCode,
  origin,
  withAuth = false,
  previewMode = false,
  enabled = true,
}: UseInventoryStoreOptions) {
  const [store, setStore] = useState<CatalogStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refetch = useCallback(async () => {
    if (!enabled || !businessId.trim()) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const fetchOne =
        withAuth || previewMode
          ? fetchAuthenticatedCatalogStoreById
          : fetchPublicCatalogStoreById;
      const envelope = await fetchOne(
        businessId.trim(),
        {
          ...(countryCode && { country_code: countryCode }),
          ...(origin && { origin_lat: origin.lat, origin_lng: origin.lng }),
          ...(previewMode && { owner_preview: true }),
        },
        { signal: controller.signal }
      );
      if (controller.signal.aborted) return;
      if (!envelope.success) {
        setError(envelope.message || 'Store not found');
        setStore(null);
        return;
      }
      setStore(envelope.data?.store ?? null);
    } catch (e: unknown) {
      if (controller.signal.aborted) return;
      if (e instanceof Error && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Failed to load store');
      setStore(null);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [
    enabled,
    businessId,
    withAuth,
    previewMode,
    countryCode,
    origin?.lat,
    origin?.lng,
  ]);

  useEffect(() => {
    if (!enabled) {
      abortRef.current?.abort();
      setStore(null);
      setLoading(false);
      setError(null);
      return;
    }
    setStore(null);
    void refetch();
    return () => abortRef.current?.abort();
  }, [refetch, enabled]);

  return { store, loading, error, refetch };
}
