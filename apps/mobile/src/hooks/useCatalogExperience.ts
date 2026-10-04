import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../services/apiClient';
import { publicApiGet } from '../services/publicApiClient';
import type { CatalogInventoryItem } from '../types/inventoryCatalog';

export type ExperienceProductModule = {
  id: string;
  type: 'PRODUCT_CAROUSEL' | 'RECENTLY_VIEWED';
  title: string;
  products: CatalogInventoryItem[];
};

type ExperienceResponse = {
  data?: { modules?: Array<{ id: string; type: string; title: string; products?: CatalogInventoryItem[] }> };
};

/** Discovery modules, including recently viewed when the shopper is signed in. */
export function useCatalogExperience(enabled: boolean, authenticated: boolean, countryCode?: string) {
  const { i18n } = useTranslation();
  const [modules, setModules] = useState<ExperienceProductModule[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setModules([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const params = {
      layout: 'discovery',
      device: 'mobile',
      language: i18n.language.toLowerCase().startsWith('fr') ? 'fr' : 'en',
      country_code: countryCode,
    };
    const request = authenticated
      ? api.get<ExperienceResponse>(withQuery('/catalog/experience', params))
      : publicApiGet<ExperienceResponse>('/catalog/experience', params);
    void Promise.resolve(request)
      .then((response) => {
        if (cancelled) return;
        setModules(productModules(response.data?.modules ?? []));
      })
      .catch(() => {
        if (!cancelled) setModules([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authenticated, countryCode, enabled, i18n.language]);

  return { modules, loading };
}

function withQuery(path: string, params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  return `${path}?${search.toString()}`;
}

function productModules(rows: NonNullable<ExperienceResponse['data']>['modules']): ExperienceProductModule[] {
  return (rows ?? []).flatMap((row) => {
    if (row.type !== 'PRODUCT_CAROUSEL' && row.type !== 'RECENTLY_VIEWED') return [];
    if (!row.products?.length) return [];
    return [{ id: row.id, type: row.type, title: row.title, products: row.products }];
  });
}
