import { useMemo } from 'react';
import { useMarket } from './useMarket';

export interface CatalogGeoParams {
  country_code?: string;
  state?: string;
  ready: boolean;
}

/** Market-driven geo params for catalog API calls (inventory, stores, collections, rentals). */
export function useCatalogGeoParams(): CatalogGeoParams {
  const { selectedMarket, hydrated } = useMarket();

  return useMemo(() => {
    if (!hydrated || !selectedMarket) {
      return { ready: false };
    }
    return {
      ready: true,
      country_code: selectedMarket.countryCode,
      ...(selectedMarket.stateCode ? { state: selectedMarket.stateCode } : {}),
    };
  }, [hydrated, selectedMarket?.countryCode, selectedMarket?.stateCode]);
}

export function catalogGeoQueryParams(geo: CatalogGeoParams): {
  country_code?: string;
  state?: string;
} {
  if (!geo.ready || !geo.country_code) return {};
  return {
    country_code: geo.country_code,
    ...(geo.state ? { state: geo.state } : {}),
  };
}
