import { useEffect, useState } from 'react';
import {
  fetchCatalogCategoryRail,
  type CatalogCategoryTile,
} from '../services/catalogExperienceApi';

export function useCatalogCategoryRail(options: {
  enabled: boolean;
  countryCode?: string;
  state?: string;
  language: string;
}) {
  const [title, setTitle] = useState('');
  const [items, setItems] = useState<CatalogCategoryTile[]>([]);

  useEffect(() => {
    if (!options.enabled) {
      setItems([]);
      return;
    }
    let cancelled = false;
    void fetchCatalogCategoryRail({
      country_code: options.countryCode,
      state: options.state,
      language: options.language.startsWith('fr') ? 'fr' : 'en',
    })
      .then((rail) => {
        if (cancelled) return;
        setTitle(rail?.title ?? '');
        setItems(rail?.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [options.enabled, options.countryCode, options.state, options.language]);

  return { title, items };
}
