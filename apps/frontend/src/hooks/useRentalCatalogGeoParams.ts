import { useMemo } from 'react';
import { useMarket } from './useMarket';

/** Market-driven geo params for rental catalog API calls. */
export function useRentalCatalogGeoParams(): {
  country_code?: string;
  state?: string;
  ready: boolean;
} {
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
