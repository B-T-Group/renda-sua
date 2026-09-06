import { useMemo } from 'react';
import type { RentalCatalogGeoParams } from '../types/rentals';
import { useMarket } from './useMarket';

/**
 * Geo scope for rental catalog queries — driven by MarketStore (same as catalog browse).
 */
export function useRentalCatalogGeoParams(): RentalCatalogGeoParams & {
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
