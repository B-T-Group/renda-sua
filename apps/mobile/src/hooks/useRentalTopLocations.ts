import { useCallback, useEffect, useRef, useState } from 'react';
import { getTopRentalLocations } from '../services/rentalsApi';
import type { RentalOrigin, TopRentalLocationRow } from '../types/rentals';
import { useRentalCatalogGeoParams } from './useRentalCatalogGeoParams';

export function useRentalTopLocations(options: {
  enabled?: boolean;
  limit?: number;
  origin?: RentalOrigin | null;
}) {
  const { enabled = true, limit = 8, origin } = options;
  const geo = useRentalCatalogGeoParams();
  const [locations, setLocations] = useState<TopRentalLocationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const fetchLocations = useCallback(async () => {
    if (!enabled || !geo.ready) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const rows = await getTopRentalLocations({
        country_code: geo.country_code,
        state: geo.state,
        limit,
        ...(origin ? { origin_lat: origin.lat, origin_lng: origin.lng } : {}),
      });
      if (requestId !== requestIdRef.current) return;
      setLocations(rows);
    } catch (e: unknown) {
      if (requestId !== requestIdRef.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load locations');
      setLocations([]);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [enabled, geo.ready, geo.country_code, geo.state, limit, origin]);

  useEffect(() => {
    void fetchLocations();
  }, [fetchLocations]);

  return { locations, loading, error, refetch: fetchLocations };
}
