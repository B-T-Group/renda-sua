import i18n from '../i18n';
import type { CollectionsListEnvelope } from '../types/collections';
import { apiRequest } from './apiClient';
import { publicApiGet } from './publicApiClient';

export interface FetchCollectionsParams {
  featured?: boolean;
  search?: string;
  country_code?: string;
  origin_lat?: number;
  origin_lng?: number;
}

function collectionsPath(params: FetchCollectionsParams): string {
  const search = new URLSearchParams();
  if (params.featured) search.set('featured', 'true');
  if (params.search?.trim()) search.set('search', params.search.trim());
  if (params.country_code) search.set('country_code', params.country_code);
  if (typeof params.origin_lat === 'number') {
    search.set('origin_lat', String(params.origin_lat));
  }
  if (typeof params.origin_lng === 'number') {
    search.set('origin_lng', String(params.origin_lng));
  }
  search.set('lang', i18n.language?.startsWith('fr') ? 'fr' : 'en');
  const q = search.toString();
  return q ? `/collections?${q}` : '/collections';
}

export async function fetchPublicCollections(
  params: FetchCollectionsParams,
  init?: { signal?: AbortSignal }
): Promise<CollectionsListEnvelope> {
  return publicApiGet<CollectionsListEnvelope>(collectionsPath(params), undefined, init);
}

export async function fetchAuthenticatedCollections(
  params: FetchCollectionsParams,
  init?: { signal?: AbortSignal }
): Promise<CollectionsListEnvelope> {
  return apiRequest<CollectionsListEnvelope>(collectionsPath(params), {
    method: 'GET',
    signal: init?.signal,
  });
}
