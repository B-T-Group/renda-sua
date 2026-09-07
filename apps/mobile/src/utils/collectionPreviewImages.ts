import {
  fetchAuthenticatedInventoryItems,
  fetchPublicInventoryItems,
} from '../services/inventoryItemsApi';
import type { CollectionSummary } from '../types/collections';
import { primaryCatalogImageUrl } from './catalogInventoryDisplay';

const PREVIEW_SLOT_COUNT = 4;

export interface FetchCollectionPreviewParams {
  withAuth?: boolean;
  countryCode?: string;
  origin?: { lat: number; lng: number } | null;
}

/** Load up to four primary item image URLs for a collection from the catalog API. */
export async function fetchCollectionPreviewImageUrls(
  slug: string,
  params: FetchCollectionPreviewParams = {}
): Promise<string[]> {
  const fetchList = params.withAuth
    ? fetchAuthenticatedInventoryItems
    : fetchPublicInventoryItems;
  const envelope = await fetchList({
    collection: slug,
    page: 1,
    limit: PREVIEW_SLOT_COUNT,
    sort: 'relevance',
    ...(params.countryCode && { country_code: params.countryCode }),
    ...(params.origin && {
      origin_lat: params.origin.lat,
      origin_lng: params.origin.lng,
    }),
  });
  if (!envelope.success) return [];
  const seenItems = new Set<string>();
  const urls: string[] = [];
  for (const inv of envelope.data.items) {
    if (seenItems.has(inv.item_id)) continue;
    const url = primaryCatalogImageUrl(inv);
    if (!url || urls.includes(url)) continue;
    seenItems.add(inv.item_id);
    urls.push(url);
    if (urls.length >= PREVIEW_SLOT_COUNT) break;
  }
  return urls;
}

function mergePreviewUrls(apiUrls: string[] | undefined, fetched: string[]): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();
  for (const raw of [...(apiUrls ?? []), ...fetched]) {
    const url = raw?.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    merged.push(url);
    if (merged.length >= PREVIEW_SLOT_COUNT) break;
  }
  return merged;
}

/** Ensures each collection has up to four primary item preview URLs. */
export async function enrichCollectionsWithPreviewImages(
  collections: CollectionSummary[],
  params: FetchCollectionPreviewParams = {}
): Promise<CollectionSummary[]> {
  return Promise.all(
    collections.map(async (collection) => {
      const apiUrls = collection.preview_image_urls ?? [];
      if (apiUrls.filter((u) => u?.trim()).length >= PREVIEW_SLOT_COUNT) {
        return collection;
      }
      const fetched = await fetchCollectionPreviewImageUrls(collection.slug, params);
      const preview_image_urls = mergePreviewUrls(apiUrls, fetched);
      return preview_image_urls.length > 0 ? { ...collection, preview_image_urls } : collection;
    })
  );
}
