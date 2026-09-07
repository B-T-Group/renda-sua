import type { AdminCatalogItemsQuery } from '../types/adminCatalogItems';

/** Build query string for GET /admin/items. Pure helper for tests. */
export function buildAdminCatalogItemsSearchParams(
  params: AdminCatalogItemsQuery
): string {
  const search = new URLSearchParams();
  if (params.q?.trim()) search.set('q', params.q.trim());
  if (params.businessId) search.set('businessId', params.businessId);
  if (params.from) search.set('from', params.from);
  if (params.to) search.set('to', params.to);
  if (params.moderationStatus) {
    search.set('moderationStatus', params.moderationStatus);
  }
  if (params.isActive !== undefined) {
    search.set('isActive', String(params.isActive));
  }
  search.set('page', String(params.page ?? 1));
  search.set('limit', String(params.limit ?? 20));
  return search.toString();
}
