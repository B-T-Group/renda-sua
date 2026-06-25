import type { AxiosInstance } from 'axios';
import type { CollectionSummary } from '../hooks/useCollections';
import type { InventoryItem } from '../hooks/useInventoryItems';
import { DETECTED_COUNTRY_STORAGE_KEY } from '../hooks/useDetectedCountry';
import type { PublicBrowserGeo } from '../hooks/usePublicBrowserGeo';

const PREVIEW_SLOT_COUNT = 4;

function primaryInventoryImageUrl(item: InventoryItem): string | undefined {
  const imgs = [...(item.item.item_images ?? [])].sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
  );
  const url = imgs[0]?.image_url?.trim();
  return url || undefined;
}

function resolveCountryCode(
  isAuthenticated: boolean,
  supportedIsos: string[]
): string | undefined {
  if (isAuthenticated) return undefined;
  const detected =
    typeof window !== 'undefined'
      ? localStorage.getItem(DETECTED_COUNTRY_STORAGE_KEY)
      : null;
  const code = detected?.toUpperCase();
  if (code && supportedIsos.includes(code)) {
    return code;
  }
  return undefined;
}

async function fetchCollectionPreviewImageUrls(
  apiClient: AxiosInstance,
  slug: string,
  options: {
    isAuthenticated: boolean;
    anonymousOrigin?: PublicBrowserGeo | null;
    supportedIsos: string[];
  }
): Promise<string[]> {
  const country_code = resolveCountryCode(
    options.isAuthenticated,
    options.supportedIsos
  );
  const response = await apiClient.get<{
    success: boolean;
    data: { items: InventoryItem[] };
  }>('/inventory-items', {
    params: {
      page: 1,
      limit: PREVIEW_SLOT_COUNT,
      is_active: true,
      sort: 'relevance',
      collection: slug,
      ...(country_code && { country_code }),
      ...(!options.isAuthenticated &&
        options.anonymousOrigin && {
          origin_lat: options.anonymousOrigin.lat,
          origin_lng: options.anonymousOrigin.lng,
        }),
    },
  });
  if (!response.data.success) return [];
  const seenItems = new Set<string>();
  const urls: string[] = [];
  for (const inv of response.data.data.items ?? []) {
    if (seenItems.has(inv.item_id)) continue;
    const url = primaryInventoryImageUrl(inv);
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

export async function enrichCollectionsWithPreviewImages(
  collections: CollectionSummary[],
  apiClient: AxiosInstance,
  options: {
    isAuthenticated: boolean;
    anonymousOrigin?: PublicBrowserGeo | null;
    supportedIsos: string[];
  }
): Promise<CollectionSummary[]> {
  return Promise.all(
    collections.map(async (collection) => {
      const apiUrls = collection.preview_image_urls ?? [];
      if (apiUrls.filter((u) => u?.trim()).length >= PREVIEW_SLOT_COUNT) {
        return collection;
      }
      try {
        const fetched = await fetchCollectionPreviewImageUrls(
          apiClient,
          collection.slug,
          options
        );
        const preview_image_urls = mergePreviewUrls(apiUrls, fetched);
        return preview_image_urls.length > 0
          ? { ...collection, preview_image_urls }
          : collection;
      } catch {
        return collection;
      }
    })
  );
}
