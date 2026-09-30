import type { AxiosInstance } from 'axios';
import { useEffect, useState } from 'react';
import type { CatalogCategoryTile } from '../components/catalog-experience/catalogExperience.types';
import { useApiClient } from './useApiClient';
import { catalogGeoQueryParams, useCatalogGeoParams } from './useCatalogGeoParams';

export function useCatalogCategories() {
  const apiClient = useApiClient();
  const catalogGeo = useCatalogGeoParams();
  const [categories, setCategories] = useState<CatalogCategoryTile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!apiClient || !catalogGeo.ready) return undefined;
    let cancelled = false;
    setLoading(true);
    void loadCategories(apiClient, catalogGeo, () => cancelled).then((rows) => {
      if (cancelled) return;
      setCategories(rows);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [apiClient, catalogGeo, catalogGeo.ready, catalogGeo.country_code, catalogGeo.state]);

  return { categories, loading };
}

async function loadCategories(
  apiClient: AxiosInstance,
  catalogGeo: { country_code?: string; state?: string },
  isCancelled: () => boolean
): Promise<CatalogCategoryTile[]> {
  try {
    const response = await apiClient.get<{ data?: { categories?: CatalogCategoryTile[] } }>(
      '/catalog/experience/categories',
      { params: catalogGeoQueryParams({ ...catalogGeo, ready: true }) }
    );
    if (isCancelled()) return [];
    return response.data?.data?.categories ?? [];
  } catch {
    return [];
  }
}
