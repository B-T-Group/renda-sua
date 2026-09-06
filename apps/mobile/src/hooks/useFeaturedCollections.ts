import { useCallback, useEffect, useState } from 'react';
import {
  fetchAuthenticatedCollections,
  fetchPublicCollections,
} from '../services/collectionsApi';
import type { CollectionSummary } from '../types/collections';
import { enrichCollectionsWithPreviewImages } from '../utils/collectionPreviewImages';

export interface UseFeaturedCollectionsOptions {
  withAuth?: boolean;
  countryCode?: string;
  origin?: { lat: number; lng: number } | null;
  enabled?: boolean;
}

export function useFeaturedCollections({
  withAuth = false,
  countryCode,
  origin,
  enabled = true,
}: UseFeaturedCollectionsOptions) {
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const fetcher = withAuth ? fetchAuthenticatedCollections : fetchPublicCollections;
      const res = await fetcher({
        featured: true,
        country_code: countryCode,
        origin_lat: origin?.lat,
        origin_lng: origin?.lng,
      });
      if (res.success) {
        const rows = res.data.collections ?? [];
        setCollections(rows);
        const withPreviews = await enrichCollectionsWithPreviewImages(rows, {
          withAuth,
          countryCode,
          origin,
        });
        setCollections(withPreviews);
      } else {
        setError(res.message ?? 'Failed to load collections');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load collections');
    } finally {
      setLoading(false);
    }
  }, [countryCode, enabled, origin?.lat, origin?.lng, withAuth]);

  useEffect(() => {
    void load();
  }, [load]);

  return { collections, loading, error, refetch: load };
}
