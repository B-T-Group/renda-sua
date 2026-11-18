import type { AxiosInstance } from 'axios';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  isVisualCatalogModule,
  type CatalogExperienceResponse,
  type CatalogModule,
} from '../components/catalog-experience/catalogExperience.types';
import { useApiClient } from './useApiClient';
import { catalogGeoQueryParams, useCatalogGeoParams } from './useCatalogGeoParams';

export type CatalogExperienceSurface = 'all' | 'food' | 'export' | 'rentals';

export function useCatalogExperience(
  enabled: boolean,
  surface: CatalogExperienceSurface = 'all'
) {
  const apiClient = useApiClient();
  const catalogGeo = useCatalogGeoParams();
  const { i18n } = useTranslation();
  const [modules, setModules] = useState<CatalogModule[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!enabled || !apiClient || !catalogGeo.ready) {
      setModules([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    void loadExperience(
      apiClient,
      catalogGeo,
      i18n.language,
      surface,
      () => cancelled
    ).then((result) => {
      if (cancelled || !result) return;
      setModules(result.modules);
      setFailed(result.failed);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    apiClient,
    catalogGeo,
    catalogGeo.ready,
    catalogGeo.country_code,
    catalogGeo.state,
    i18n.language,
    surface,
  ]);

  return { modules, loading, failed };
}

async function loadExperience(
  apiClient: AxiosInstance,
  catalogGeo: { ready: boolean; country_code?: string; state?: string },
  language: string,
  surface: CatalogExperienceSurface,
  isCancelled: () => boolean
): Promise<{ modules: CatalogModule[]; failed: boolean } | null> {
  try {
    const response = await apiClient.get<{ data?: CatalogExperienceResponse }>(
      '/catalog/experience',
      experienceParams(catalogGeo, language, surface)
    );
    if (isCancelled()) return null;
    const modules = response.data?.data?.modules ?? [];
    return { modules, failed: !modules.some(isVisualCatalogModule) };
  } catch {
    if (isCancelled()) return null;
    return { modules: [], failed: true };
  }
}

function experienceParams(
  catalogGeo: { country_code?: string; state?: string },
  language: string,
  surface: CatalogExperienceSurface
) {
  return {
    params: {
      ...catalogGeoQueryParams({ ...catalogGeo, ready: true }),
      language: language.startsWith('fr') ? 'fr' : 'en',
      layout: 'discovery',
      device: 'web',
      surface,
    },
  };
}
