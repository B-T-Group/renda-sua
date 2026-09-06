import { useCallback, useState } from 'react';
import { businessApi } from '../../services/businessApi';
import type {
  TransferBusinessOption,
  TransferMode,
  TransferPreview,
  TransferRequest,
} from '../../types/business/locationTransfer';

export function useLocationTransfers(businessId?: string) {
  const [incoming, setIncoming] = useState<TransferRequest[]>([]);
  const [outgoing, setOutgoing] = useState<TransferRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await businessApi.locations.listPendingTransfers(businessId);
      setIncoming(res.data?.incoming ?? []);
      setOutgoing(res.data?.outgoing ?? []);
    } catch (err: unknown) {
      setError((err as Error)?.message ?? 'Failed to load');
      setIncoming([]);
      setOutgoing([]);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  const searchBusinesses = useCallback(
    async (q: string): Promise<TransferBusinessOption[]> => {
      if (!q.trim()) return [];
      const res = await businessApi.locations.searchBusinesses(q, businessId);
      return res.data?.businesses ?? [];
    },
    [businessId]
  );

  const listDestLocations = useCallback(
    async (targetBusinessId: string) => {
      const res = await businessApi.locations.listDestLocations(
        targetBusinessId,
        businessId
      );
      return res.data?.locations ?? [];
    },
    [businessId]
  );

  const previewTransfer = useCallback(
    async (
      locationId: string,
      toBusinessId: string,
      options?: { mode?: TransferMode; toLocationId?: string }
    ): Promise<TransferPreview> => {
      const res = await businessApi.locations.transferPreview(
        locationId,
        toBusinessId,
        businessId,
        options
      );
      return res.data;
    },
    [businessId]
  );

  const createRequest = useCallback(
    async (
      locationId: string,
      toBusinessId: string,
      confirmBusinessName: string,
      options?: { mode?: TransferMode; toLocationId?: string }
    ): Promise<TransferRequest> => {
      const res = await businessApi.locations.createTransferRequest(
        locationId,
        {
          toBusinessId,
          confirmBusinessName,
          mode: options?.mode,
          toLocationId: options?.toLocationId,
        },
        businessId
      );
      return res.data.request;
    },
    [businessId]
  );

  const acceptRequest = useCallback(async (id: string) => {
    const res = await businessApi.locations.acceptTransferRequest(id);
    return res.data.request;
  }, []);

  const rejectRequest = useCallback(async (id: string) => {
    const res = await businessApi.locations.rejectTransferRequest(id);
    return res.data.request;
  }, []);

  const cancelRequest = useCallback(
    async (id: string) => {
      const res = await businessApi.locations.cancelTransferRequest(
        id,
        businessId
      );
      return res.data.request;
    },
    [businessId]
  );

  const getRequest = useCallback(
    async (id: string) => {
      const res = await businessApi.locations.getTransferRequest(
        id,
        businessId
      );
      return res.data.request;
    },
    [businessId]
  );

  return {
    incoming,
    outgoing,
    loading,
    error,
    fetchPending,
    searchBusinesses,
    listDestLocations,
    previewTransfer,
    createRequest,
    acceptRequest,
    rejectRequest,
    cancelRequest,
    getRequest,
  };
}
