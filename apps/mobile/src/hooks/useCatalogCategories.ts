import { useEffect, useState } from 'react';
import { useMarket } from './useMarket';
import {
  fetchCatalogCategories,
  type CatalogCategoryTile,
} from '../services/catalogExperienceApi';

export function useCatalogCategories() {
  const { selectedMarket, hydrated } = useMarket();
  const [categories, setCategories] = useState<CatalogCategoryTile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hydrated) return undefined;
    if (!selectedMarket) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    void loadCategories(selectedMarket.countryCode, selectedMarket.stateCode, () => cancelled)
      .then((rows) => {
        if (cancelled) return;
        setCategories(rows);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, selectedMarket?.countryCode, selectedMarket?.stateCode]);

  return { categories, loading };
}

async function loadCategories(
  countryCode: string,
  stateCode: string | null | undefined,
  isCancelled: () => boolean
): Promise<CatalogCategoryTile[]> {
  try {
    const rows = await fetchCatalogCategories({
      country_code: countryCode,
      ...(stateCode ? { state: stateCode } : {}),
    });
    return isCancelled() ? [] : rows;
  } catch {
    return [];
  }
}
