import { useCallback, useState } from 'react';
import { useApiClient } from './useApiClient';

export type BroadcastAudienceType = 'everyone' | 'business' | 'agent' | 'client';
export type BroadcastTemplateKey =
  | 'custom'
  | 'app_upgrade'
  | 'business_account_setup';

export interface BroadcastFilters {
  lifecycleStatuses?: string[];
  isStorefrontVisible?: boolean;
  canAcceptOrders?: boolean;
  isAvailable?: boolean;
  countries?: string[];
}

export interface BroadcastPreviewResult {
  total: number;
  withPushToken: number;
  wouldSkipDedupe: number;
  eligible: number;
}

export interface BroadcastCampaign {
  id: string;
  created_at: string;
  status: string;
  audience_type: string;
  filters: BroadcastFilters;
  template_key: string;
  action_type: string;
  source_title?: string | null;
  source_body: string;
  title_en: string;
  body_en: string;
  title_fr: string;
  body_fr: string;
  target_count: number;
  eligible_count: number;
  sent_count: number;
  skipped_dedupe_count: number;
  failed_count: number;
  error_message?: string | null;
  created_by_user?: {
    first_name?: string;
    last_name?: string;
    email?: string;
  };
}

export interface CreateBroadcastInput {
  audienceType: BroadcastAudienceType;
  filters?: BroadcastFilters;
  templateKey: BroadcastTemplateKey;
  title?: string;
  body: string;
  sourceLanguage?: 'en' | 'fr';
}

export function useAdminBroadcasts() {
  const apiClient = useApiClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = useCallback(
    async (input: {
      audienceType: BroadcastAudienceType;
      filters?: BroadcastFilters;
      messageHash?: string;
      templateKey?: BroadcastTemplateKey;
      title?: string;
      body?: string;
    }): Promise<BroadcastPreviewResult> => {
      if (!apiClient) {
        return { total: 0, withPushToken: 0, wouldSkipDedupe: 0, eligible: 0 };
      }
      setError(null);
      try {
        const { data } = await apiClient.post<{
          success: boolean;
          total: number;
          withPushToken: number;
          wouldSkipDedupe: number;
          eligible: number;
        }>('/admin/broadcasts/preview', input);
        return {
          total: data.total ?? 0,
          withPushToken: data.withPushToken ?? 0,
          wouldSkipDedupe: data.wouldSkipDedupe ?? 0,
          eligible: data.eligible ?? 0,
        };
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data
            ?.message || 'Failed to preview audience';
        setError(msg);
        throw e;
      }
    },
    [apiClient]
  );

  const create = useCallback(
    async (input: CreateBroadcastInput): Promise<BroadcastCampaign> => {
      if (!apiClient) throw new Error('No API client');
      setLoading(true);
      setError(null);
      try {
        const { data } = await apiClient.post<{
          success: boolean;
          campaign: BroadcastCampaign;
        }>('/admin/broadcasts', input);
        return data.campaign;
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data
            ?.message || 'Failed to create broadcast';
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  const list = useCallback(
    async (page = 1, limit = 20) => {
      if (!apiClient) {
        return {
          items: [] as BroadcastCampaign[],
          pagination: { page: 1, limit, total: 0, totalPages: 0 },
        };
      }
      setLoading(true);
      setError(null);
      try {
        const { data } = await apiClient.get<{
          success: boolean;
          items: BroadcastCampaign[];
          pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
          };
        }>('/admin/broadcasts', { params: { page, limit } });
        return {
          items: data.items ?? [],
          pagination: data.pagination ?? {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        };
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data
            ?.message || 'Failed to load broadcasts';
        setError(msg);
        return {
          items: [] as BroadcastCampaign[],
          pagination: { page: 1, limit, total: 0, totalPages: 0 },
        };
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  return { preview, create, list, loading, error };
}
