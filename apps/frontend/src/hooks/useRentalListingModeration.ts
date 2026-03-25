import { useCallback, useState } from 'react';
import { useApiClient } from './useApiClient';

export type RentalModerationQueueStatus = 'pending' | 'rejected' | 'all';

export interface ModerationListingRow {
  id: string;
  moderation_status: string;
  created_at: string;
  base_price_per_hour: number | string;
  rental_item: {
    id: string;
    name: string;
    business: { name: string; user_id: string };
  };
  business_location: { id: string; name: string };
}

export interface ModerationPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function useRentalListingModeration() {
  const apiClient = useApiClient();
  const [listings, setListings] = useState<ModerationListingRow[]>([]);
  const [pagination, setPagination] = useState<ModerationPagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = useCallback(
    async (status: RentalModerationQueueStatus, page: number, limit: number) => {
      if (!apiClient) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          status,
          page: String(page),
          limit: String(limit),
        });
        const { data } = await apiClient.get<{
          success: boolean;
          listings: ModerationListingRow[];
          pagination: ModerationPagination;
          error?: string;
        }>(`/admin/rental-listings/moderation?${params.toString()}`);
        if (!data.success) {
          throw new Error(data.error || 'Request failed');
        }
        setListings(data.listings ?? []);
        setPagination(data.pagination ?? null);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load');
        setListings([]);
        setPagination(null);
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  const approveListing = useCallback(
    async (listingId: string) => {
      if (!apiClient) return false;
      const { data } = await apiClient.post<{ success: boolean; error?: string }>(
        `/admin/rental-listings/${listingId}/approve`,
        {}
      );
      return !!data.success;
    },
    [apiClient]
  );

  const rejectListing = useCallback(
    async (listingId: string, rejectionReason: string) => {
      if (!apiClient) return false;
      const { data } = await apiClient.post<{ success: boolean; error?: string }>(
        `/admin/rental-listings/${listingId}/reject`,
        { rejectionReason }
      );
      return !!data.success;
    },
    [apiClient]
  );

  return {
    listings,
    pagination,
    loading,
    error,
    fetchQueue,
    approveListing,
    rejectListing,
  };
}
