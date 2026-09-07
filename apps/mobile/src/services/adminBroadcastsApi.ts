import { apiRequest } from './apiClient';
import type {
  BroadcastAudienceType,
  BroadcastCampaign,
  BroadcastFilters,
  BroadcastPreviewResult,
  BroadcastTemplateKey,
  BroadcastUserOption,
} from '../types/adminBroadcast';

export async function previewAdminBroadcast(input: {
  audienceType: BroadcastAudienceType;
  filters?: BroadcastFilters;
  templateKey?: BroadcastTemplateKey;
  title?: string;
  body?: string;
}): Promise<BroadcastPreviewResult> {
  const res = await apiRequest<{
    success: boolean;
    total?: number;
    withPushToken?: number;
    wouldSkipDedupe?: number;
    eligible?: number;
  }>('/admin/broadcasts/preview', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return {
    total: res.total ?? 0,
    withPushToken: res.withPushToken ?? 0,
    wouldSkipDedupe: res.wouldSkipDedupe ?? 0,
    eligible: res.eligible ?? 0,
  };
}

export async function createAdminBroadcast(input: {
  audienceType: BroadcastAudienceType;
  filters?: BroadcastFilters;
  templateKey: BroadcastTemplateKey;
  title?: string;
  body: string;
  sourceLanguage?: 'en' | 'fr';
}): Promise<BroadcastCampaign> {
  const res = await apiRequest<{
    success: boolean;
    campaign?: BroadcastCampaign;
    error?: string;
  }>('/admin/broadcasts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!res.success || !res.campaign) {
    throw new Error(res.error || 'Failed to create broadcast');
  }
  return res.campaign;
}

export async function listAdminBroadcasts(
  page = 1,
  limit = 20
): Promise<{ items: BroadcastCampaign[]; total: number }> {
  const qs = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  const res = await apiRequest<{
    success: boolean;
    items?: BroadcastCampaign[];
    pagination?: { total?: number };
  }>(`/admin/broadcasts?${qs.toString()}`, { method: 'GET' });
  return {
    items: res.items ?? [],
    total: res.pagination?.total ?? 0,
  };
}

export async function searchAdminBroadcastUsers(
  query: string
): Promise<BroadcastUserOption[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const qs = new URLSearchParams({ q });
  const res = await apiRequest<{
    success: boolean;
    users?: BroadcastUserOption[];
  }>(`/admin/broadcasts/users/search?${qs.toString()}`, { method: 'GET' });
  return res.users ?? [];
}

export const adminBroadcastsApi = {
  preview: previewAdminBroadcast,
  create: createAdminBroadcast,
  list: listAdminBroadcasts,
  searchUsers: searchAdminBroadcastUsers,
};
