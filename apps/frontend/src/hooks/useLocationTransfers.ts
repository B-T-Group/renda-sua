import { useCallback, useState } from 'react';
import { useApiClient } from './useApiClient';
import type { TransferBusinessOption } from './useBusinessSearch';

export interface TransferPreview {
  locationId: string;
  locationName: string;
  fromBusiness: TransferBusinessOption;
  toBusiness: TransferBusinessOption;
  itemCount: number;
  rentalItemCount: number;
  orderCount: number;
  completedOrderCount: number;
  canTransfer: boolean;
  blockReasons: string[];
}

export interface TransferRequest {
  id: string;
  business_location_id: string;
  from_business_id: string;
  to_business_id: string;
  status: string;
  item_count: number;
  rental_item_count: number;
  order_count: number;
  expires_at: string;
  responded_at: string | null;
  created_at: string;
  business_location?: { id: string; name: string };
  from_business?: { id: string; name: string };
  to_business?: { id: string; name: string };
  requested_by_user?: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
  };
  metadata?: Record<string, unknown>;
}

function withBusinessId(path: string, businessId?: string): string {
  if (!businessId) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}businessId=${encodeURIComponent(businessId)}`;
}

export function useLocationTransfers(businessId?: string) {
  const apiClient = useApiClient();
  const [incoming, setIncoming] = useState<TransferRequest[]>([]);
  const [outgoing, setOutgoing] = useState<TransferRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    if (!apiClient) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get(
        withBusinessId('/business-items/transfer-requests/pending', businessId)
      );
      setIncoming(data?.data?.incoming || []);
      setOutgoing(data?.data?.outgoing || []);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [apiClient, businessId]);

  const previewTransfer = useCallback(
    async (locationId: string, toBusinessId: string) => {
      if (!apiClient) throw new Error('No API client');
      const params = new URLSearchParams({ toBusinessId });
      if (businessId) params.set('businessId', businessId);
      const { data } = await apiClient.get(
        `/business-items/locations/${locationId}/transfer-preview?${params}`
      );
      return (data?.data || data) as TransferPreview;
    },
    [apiClient, businessId]
  );

  const createRequest = useCallback(
    async (
      locationId: string,
      toBusinessId: string,
      confirmBusinessName: string
    ) => {
      if (!apiClient) throw new Error('No API client');
      const { data } = await apiClient.post(
        withBusinessId(
          `/business-items/locations/${locationId}/transfer-requests`,
          businessId
        ),
        { toBusinessId, confirmBusinessName }
      );
      return data?.data?.request as TransferRequest;
    },
    [apiClient, businessId]
  );

  const acceptRequest = useCallback(
    async (id: string) => {
      if (!apiClient) throw new Error('No API client');
      const { data } = await apiClient.post(
        `/business-items/transfer-requests/${id}/accept`
      );
      return data?.data?.request as TransferRequest;
    },
    [apiClient]
  );

  const rejectRequest = useCallback(
    async (id: string) => {
      if (!apiClient) throw new Error('No API client');
      const { data } = await apiClient.post(
        `/business-items/transfer-requests/${id}/reject`
      );
      return data?.data?.request as TransferRequest;
    },
    [apiClient]
  );

  const cancelRequest = useCallback(
    async (id: string) => {
      if (!apiClient) throw new Error('No API client');
      const { data } = await apiClient.post(
        withBusinessId(
          `/business-items/transfer-requests/${id}/cancel`,
          businessId
        )
      );
      return data?.data?.request as TransferRequest;
    },
    [apiClient, businessId]
  );

  return {
    incoming,
    outgoing,
    loading,
    error,
    fetchPending,
    previewTransfer,
    createRequest,
    acceptRequest,
    rejectRequest,
    cancelRequest,
  };
}
