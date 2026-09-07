import { apiRequest } from './apiClient';
import { buildAdminCatalogItemsSearchParams } from '../utils/adminCatalogItemsQuery';
import type {
  AdminCatalogItemDetail,
  AdminCatalogItemsListResult,
  AdminCatalogItemsQuery,
  AdminCatalogItemUpdatePayload,
  AdminCleanupSelection,
} from '../types/adminCatalogItems';

export async function fetchAdminCatalogItems(
  params: AdminCatalogItemsQuery
): Promise<AdminCatalogItemsListResult> {
  const qs = buildAdminCatalogItemsSearchParams(params);
  const res = await apiRequest<{
    success: boolean;
    items?: AdminCatalogItemsListResult['items'];
    pagination?: AdminCatalogItemsListResult['pagination'];
    error?: string;
  }>(`/admin/items?${qs}`, { method: 'GET' });
  if (!res.success) {
    throw new Error(res.error || 'Failed to load items');
  }
  return {
    items: res.items ?? [],
    pagination: res.pagination ?? {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      total: 0,
      totalPages: 1,
    },
  };
}

export async function fetchAdminCatalogItem(
  itemId: string
): Promise<AdminCatalogItemDetail> {
  const res = await apiRequest<{
    success: boolean;
    item?: AdminCatalogItemDetail;
    error?: string;
  }>(`/admin/items/${encodeURIComponent(itemId)}`, { method: 'GET' });
  if (!res.success || !res.item) {
    throw new Error(res.error || 'Failed to load item');
  }
  return res.item;
}

export async function updateAdminCatalogItem(
  itemId: string,
  body: AdminCatalogItemUpdatePayload
): Promise<AdminCatalogItemDetail> {
  const res = await apiRequest<{
    success: boolean;
    item?: AdminCatalogItemDetail;
    error?: string;
  }>(`/admin/items/${encodeURIComponent(itemId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!res.success || !res.item) {
    throw new Error(res.error || 'Failed to update item');
  }
  return res.item;
}

export async function enqueueAdminItemCleanup(
  itemId: string,
  selections: AdminCleanupSelection[]
): Promise<{ jobId: string; status: string }> {
  const res = await apiRequest<{
    success: boolean;
    jobId?: string;
    status?: string;
    error?: string;
  }>(`/admin/items/${encodeURIComponent(itemId)}/ai-image-cleanup`, {
    method: 'POST',
    body: JSON.stringify({ selections }),
  });
  if (!res.success || !res.jobId) {
    throw new Error(res.error || 'Failed to queue cleanup');
  }
  return { jobId: res.jobId, status: res.status ?? 'queued' };
}

export const adminCatalogItemsApi = {
  fetchAdminCatalogItems,
  fetchAdminCatalogItem,
  updateAdminCatalogItem,
  enqueueAdminItemCleanup,
};
