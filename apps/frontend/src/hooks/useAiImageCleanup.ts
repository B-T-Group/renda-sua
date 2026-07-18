import { useCallback } from 'react';
import { useApiClient } from './useApiClient';

export interface AiImageCleanupResult {
  id: string;
  business_image_id: string | null;
  item_variant_image_id?: string | null;
  original_image_url: string;
  cleaned_image_url: string | null;
  status: string;
  error_message: string | null;
  retry_of_result_id?: string | null;
}

export interface AiImageCleanupJob {
  id: string;
  item_id: string;
  item_variant_id?: string | null;
  status: string;
  item?: { id: string; name: string } | null;
  item_variant?: { id: string; name: string } | null;
  results: AiImageCleanupResult[];
}

export interface AiImageCleanupPendingJob {
  id: string;
  item_id: string;
  item_variant_id?: string | null;
  status: string;
  item?: { id: string; name: string } | null;
  item_variant?: { id: string; name: string } | null;
  results?: Array<{ id: string; status: string }>;
}

export interface AiImageCleanupPendingData {
  jobs: AiImageCleanupPendingJob[];
  pendingResultCount: number;
}

export function useAiImageCleanup() {
  const apiClient = useApiClient();

  const requestCleanup = useCallback(
    async (itemId: string, imageIds?: string[]) => {
      const res = await apiClient.post<{
        success: boolean;
        data?: { job: { id: string }; ai_tokens_remaining: number };
        error?: string;
      }>(`/business-items/items/${encodeURIComponent(itemId)}/ai-image-cleanup`, {
        imageIds,
      });
      return res.data;
    },
    [apiClient]
  );

  const requestVariantCleanup = useCallback(
    async (variantId: string, imageIds?: string[]) => {
      const res = await apiClient.post<{
        success: boolean;
        data?: { job: { id: string }; ai_tokens_remaining: number };
        error?: string;
      }>(`/item-variants/${encodeURIComponent(variantId)}/ai-image-cleanup`, {
        imageIds,
      });
      return res.data;
    },
    [apiClient]
  );

  const getPending = useCallback(async (): Promise<AiImageCleanupPendingData> => {
    const res = await apiClient.get<{
      success: boolean;
      data?: AiImageCleanupPendingData;
    }>('/business-items/ai-image-cleanup/pending');
    return (
      res.data?.data ?? {
        jobs: [],
        pendingResultCount: 0,
      }
    );
  }, [apiClient]);

  const getJob = useCallback(
    async (jobId: string): Promise<AiImageCleanupJob | null> => {
      const res = await apiClient.get<{
        success: boolean;
        data?: { job: AiImageCleanupJob };
      }>(`/business-items/ai-image-cleanup/jobs/${encodeURIComponent(jobId)}`);
      return res.data?.data?.job ?? null;
    },
    [apiClient]
  );

  const acceptResult = useCallback(
    async (resultId: string) => {
      const res = await apiClient.post(
        `/business-items/ai-image-cleanup/results/${encodeURIComponent(resultId)}/accept`,
        {}
      );
      return res.data;
    },
    [apiClient]
  );

  const rejectResult = useCallback(
    async (resultId: string) => {
      const res = await apiClient.post(
        `/business-items/ai-image-cleanup/results/${encodeURIComponent(resultId)}/reject`,
        {}
      );
      return res.data;
    },
    [apiClient]
  );

  const retryResult = useCallback(
    async (resultId: string) => {
      const res = await apiClient.post<{
        success: boolean;
        data?: { ai_tokens_remaining: number };
      }>(
        `/business-items/ai-image-cleanup/results/${encodeURIComponent(resultId)}/retry`,
        {}
      );
      return res.data;
    },
    [apiClient]
  );

  const cancelJob = useCallback(
    async (jobId: string) => {
      const res = await apiClient.post(
        `/business-items/ai-image-cleanup/jobs/${encodeURIComponent(jobId)}/cancel`,
        {}
      );
      return res.data;
    },
    [apiClient]
  );

  return {
    requestCleanup,
    requestVariantCleanup,
    getPending,
    getJob,
    acceptResult,
    rejectResult,
    retryResult,
    cancelJob,
  };
}
