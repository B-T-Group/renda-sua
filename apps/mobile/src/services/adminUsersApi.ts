import { apiRequest } from './apiClient';
import type { AdminClientsListResult, AdminAgentsListResult } from '../types/adminUsers';

export async function fetchAdminClients(params: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<AdminClientsListResult> {
  const qs = new URLSearchParams();
  qs.set('page', String(params.page ?? 1));
  qs.set('limit', String(params.limit ?? 20));
  if (params.search?.trim()) qs.set('search', params.search.trim());
  const res = await apiRequest<{
    success: boolean;
    items?: AdminClientsListResult['items'];
    total?: number;
    page?: number;
    limit?: number;
    error?: string;
  }>(`/admin/clients?${qs.toString()}`, { method: 'GET' });
  if (!res.success) throw new Error(res.error || 'Failed to load clients');
  return {
    items: res.items ?? [],
    total: res.total ?? 0,
    page: res.page ?? params.page ?? 1,
    limit: res.limit ?? params.limit ?? 20,
  };
}

export async function fetchAdminAgents(params: {
  page?: number;
  limit?: number;
  search?: string;
  unverifiedOnly?: boolean;
}): Promise<AdminAgentsListResult> {
  const qs = new URLSearchParams();
  qs.set('page', String(params.page ?? 1));
  qs.set('limit', String(params.limit ?? 20));
  if (params.search?.trim()) qs.set('search', params.search.trim());
  if (params.unverifiedOnly) qs.set('unverifiedOnly', 'true');
  const res = await apiRequest<{
    success: boolean;
    items?: AdminAgentsListResult['items'];
    total?: number;
    page?: number;
    limit?: number;
    error?: string;
  }>(`/admin/agents?${qs.toString()}`, { method: 'GET' });
  if (!res.success) throw new Error(res.error || 'Failed to load agents');
  return {
    items: res.items ?? [],
    total: res.total ?? 0,
    page: res.page ?? params.page ?? 1,
    limit: res.limit ?? params.limit ?? 20,
  };
}

export async function applyAdminAgentReferral(
  agentId: string,
  code: string
): Promise<void> {
  const res = await apiRequest<{ success: boolean; error?: string }>(
    `/admin/agents/${encodeURIComponent(agentId)}/referral`,
    { method: 'POST', body: JSON.stringify({ code }) }
  );
  if (!res.success) throw new Error(res.error || 'Failed to apply referral');
}

export async function updateAdminAgent(
  agentId: string,
  patch: { is_verified?: boolean; is_internal?: boolean }
): Promise<boolean> {
  const res = await apiRequest<{ success: boolean; error?: string }>(
    `/admin/agents/${encodeURIComponent(agentId)}`,
    { method: 'PATCH', body: JSON.stringify(patch) }
  );
  return !!res.success;
}

export const adminUsersApi = {
  fetchAdminClients,
  fetchAdminAgents,
  updateAdminAgent,
  applyAdminAgentReferral,
};
