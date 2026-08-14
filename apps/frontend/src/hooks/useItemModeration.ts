import { useCallback, useState } from 'react';
import { useApiClient } from './useApiClient';

export type ItemModerationQueueStatus =
  | 'pending'
  | 'rejected'
  | 'ai_reviewing'
  | 'proposal_pending'
  | 'all';

export interface ModerationItemRow {
  id: string;
  name: string;
  description: string | null;
  moderation_status: string;
  created_at: string;
  price: number | string | null;
  currency: string | null;
  is_active: boolean;
  business: { id: string; name: string; user_id: string };
}

export interface ItemModerationPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function useItemModeration() {
  const apiClient = useApiClient();
  const [items, setItems] = useState<ModerationItemRow[]>([]);
  const [pagination, setPagination] = useState<ItemModerationPagination | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = useCallback(
    async (status: ItemModerationQueueStatus, page: number, limit: number) => {
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
          items: ModerationItemRow[];
          pagination: ItemModerationPagination;
          error?: string;
        }>(`/admin/items/moderation?${params.toString()}`);
        if (!data.success) {
          throw new Error(data.error || 'Request failed');
        }
        setItems(data.items ?? []);
        setPagination(data.pagination ?? null);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load');
        setItems([]);
        setPagination(null);
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  const approveItem = useCallback(
    async (itemId: string) => {
      if (!apiClient) return false;
      const { data } = await apiClient.post<{ success: boolean; error?: string }>(
        `/admin/items/${itemId}/approve`,
        {}
      );
      return !!data.success;
    },
    [apiClient]
  );

  const rejectItem = useCallback(
    async (itemId: string, rejectionReason: string) => {
      if (!apiClient) return false;
      const { data } = await apiClient.post<{ success: boolean; error?: string }>(
        `/admin/items/${itemId}/reject`,
        { rejectionReason }
      );
      return !!data.success;
    },
    [apiClient]
  );

  const requestAiImageCleanup = useCallback(
    async (itemId: string) => {
      if (!apiClient) {
        return { success: false as const, error: 'Not authenticated' };
      }
      try {
        const { data } = await apiClient.post<{
          success: boolean;
          jobId?: string;
          status?: string;
          appliedExistingReview?: boolean;
          error?: string;
          message?: string;
        }>(`/admin/items/${itemId}/ai-image-cleanup`, {});
        if (!data.success) {
          return {
            success: false as const,
            error: data.error || data.message || 'Request failed',
          };
        }
        return {
          success: true as const,
          jobId: data.jobId,
          status: data.status,
          appliedExistingReview: !!data.appliedExistingReview,
        };
      } catch (e: unknown) {
        const axiosErr = e as {
          response?: { data?: { error?: string; message?: string } };
          message?: string;
        };
        const msg =
          axiosErr.response?.data?.error ||
          axiosErr.response?.data?.message ||
          (e instanceof Error ? e.message : 'Request failed');
        return { success: false as const, error: String(msg) };
      }
    },
    [apiClient]
  );

  return {
    items,
    pagination,
    loading,
    error,
    fetchQueue,
    approveItem,
    rejectItem,
    requestAiImageCleanup,
  };
}
