import { useCallback, useEffect, useRef, useState } from 'react';
import { getBookedWindows, getListing } from '../services/rentalsApi';
import { useStore } from '../stores/RootStore';
import type { RentalListingRow, RentalTakenWindow } from '../types/rentals';
import { useRentalCatalogGeoParams } from './useRentalCatalogGeoParams';

export function useRentalListingDetail(listingId: string | undefined) {
  const { auth } = useStore();
  const geo = useRentalCatalogGeoParams();
  const [listing, setListing] = useState<RentalListingRow | null>(null);
  const [bookedWindows, setBookedWindows] = useState<RentalTakenWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (id: string) => {
      if (!geo.ready) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);
      try {
        const opts = {
          withAuth: auth.isAuthenticated,
          signal: controller.signal,
        };
        const geoParams = {
          ...(geo.country_code ? { country_code: geo.country_code } : {}),
          ...(geo.state ? { state: geo.state } : {}),
        };
        const [row, windows] = await Promise.all([
          getListing(id, geoParams, opts),
          getBookedWindows(id, geoParams, opts),
        ]);
        if (controller.signal.aborted) return;
        setListing(row);
        setBookedWindows(windows);
        setError(row ? null : 'Listing not found');
      } catch (e: unknown) {
        if (controller.signal.aborted) return;
        if (e instanceof Error && e.name === 'AbortError') return;
        setError(e instanceof Error ? e.message : 'Failed to load listing');
        setListing(null);
        setBookedWindows([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [auth.isAuthenticated, geo.ready, geo.country_code, geo.state]
  );

  useEffect(() => {
    if (!listingId?.trim()) {
      setListing(null);
      setBookedWindows([]);
      setLoading(false);
      setError('Missing listing');
      return;
    }
    if (!geo.ready) {
      setLoading(true);
      return;
    }
    void load(listingId.trim());
    return () => {
      abortRef.current?.abort();
    };
  }, [listingId, load, geo.ready]);

  const refetch = useCallback(async () => {
    if (listingId?.trim()) await load(listingId.trim());
  }, [listingId, load]);

  return { listing, bookedWindows, loading, error, refetch };
}
