import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';
import { useRentalCatalogGeoParams } from './useRentalCatalogGeoParams';

export type RentalListingsSortMode =
  | 'relevance'
  | 'newest'
  | 'fastest'
  | 'cheapest'
  | 'expensive';

export interface RentalListingRow {
  id: string;
  base_price_per_hour: string | number;
  min_rental_hours: number;
  max_rental_hours: number | null;
  pickup_instructions: string;
  dropoff_instructions: string;
  weekly_availability: Array<{
    weekday: number;
    is_available: boolean;
    start_time: string | null;
    end_time: string | null;
  }>;
  updated_at?: string;
  rental_item: {
    id: string;
    name: string;
    description: string;
    tags: string[];
    currency: string;
    operation_mode: string;
    rental_category: { id: string; name: string };
    rental_item_images: Array<{ id: string; image_url: string; alt_text?: string }>;
    business: { id: string; name: string; is_verified?: boolean };
  };
  business_location: {
    id: string;
    name: string;
    address: {
      id?: string;
      address_line_1?: string;
      address_line_2?: string | null;
      city?: string;
      state?: string;
      postal_code?: string;
      country?: string;
    };
  };
  distance_text?: string;
  duration_text?: string;
  distance_value?: number;
}

export interface UseRentalListingsOptions {
  sort?: RentalListingsSortMode;
}

export function useRentalListings(options: UseRentalListingsOptions = {}) {
  const api = useApiClient();
  const geo = useRentalCatalogGeoParams();
  const sort = options.sort ?? 'relevance';
  const [listings, setListings] = useState<RentalListingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<{
        success: boolean;
        data: { listings: RentalListingRow[] };
      }>('/rentals/listings', {
        params: {
          sort,
          ...geo,
        },
      });
      if (!data.success) {
        setListings([]);
        return;
      }
      setListings(data.data.listings ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load rentals');
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [api, sort, geo]);

  useEffect(() => {
    void fetchListings();
  }, [fetchListings]);

  return { listings, loading, error, refetch: fetchListings };
}
