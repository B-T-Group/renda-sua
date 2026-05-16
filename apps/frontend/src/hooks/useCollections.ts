import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiClient } from './useApiClient';
import { INVENTORY_ANONYMOUS_COUNTRY_CODES } from './useInventoryItems';
import { DETECTED_COUNTRY_STORAGE_KEY } from './useDetectedCountry';
import { useAuth0 } from '@auth0/auth0-react';
import type { PublicBrowserGeo } from './usePublicBrowserGeo';
import { enrichCollectionsWithPreviewImages } from '../utils/collectionPreviewImages';

export interface CollectionSummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  preview_image_urls?: string[];
  is_featured: boolean;
  sort_order: number;
  listing_count: number;
}

export interface UseCollectionsOptions {
  featured?: boolean;
  search?: string;
  anonymousOrigin?: PublicBrowserGeo | null;
  enabled?: boolean;
}

export function useCollections(options: UseCollectionsOptions = {}) {
  const { i18n } = useTranslation();
  const { isAuthenticated } = useAuth0();
  const apiClient = useApiClient();
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCollections = useCallback(async () => {
    if (options.enabled === false) return;
    setLoading(true);
    setError(null);
    let country_code: string | undefined;
    if (!isAuthenticated) {
      const detected =
        typeof window !== 'undefined'
          ? localStorage.getItem(DETECTED_COUNTRY_STORAGE_KEY)
          : null;
      const code = detected?.toUpperCase();
      if (code && INVENTORY_ANONYMOUS_COUNTRY_CODES.includes(code)) {
        country_code = code;
      }
    }
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: { collections: CollectionSummary[] };
        message?: string;
      }>('/collections', {
        params: {
          ...(options.featured && { featured: true }),
          ...(options.search?.trim() && { search: options.search.trim() }),
          ...(country_code && { country_code }),
          lang: i18n.language?.startsWith('fr') ? 'fr' : 'en',
          ...(!isAuthenticated &&
            options.anonymousOrigin && {
              origin_lat: options.anonymousOrigin.lat,
              origin_lng: options.anonymousOrigin.lng,
            }),
        },
      });
      if (response.data.success) {
        const rows = response.data.data.collections ?? [];
        setCollections(rows);
        const withPreviews = await enrichCollectionsWithPreviewImages(
          rows,
          apiClient,
          { isAuthenticated, anonymousOrigin: options.anonymousOrigin }
        );
        setCollections(withPreviews);
      } else {
        setError(response.data.message ?? 'Failed to load collections');
      }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Failed to load collections';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [
    apiClient,
    i18n.language,
    isAuthenticated,
    options.anonymousOrigin,
    options.enabled,
    options.featured,
    options.search,
  ]);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  return { collections, loading, error, refetch: fetchCollections };
}
