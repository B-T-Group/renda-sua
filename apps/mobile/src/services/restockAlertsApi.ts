import type { CatalogInventoryItem } from '../types/inventoryCatalog';
import { api } from './apiClient';
import { publicApiPost } from './publicApiClient';

/** Contract: plans/343-api-contract.md; backend: apps/backend/src/restock-alerts. */

export interface RestockPreferences {
  push: boolean;
  whatsapp: boolean;
  sms: boolean;
  /** User has a phone and WhatsApp on in Notifications. */
  whatsapp_available: boolean;
  /** User has a phone and SMS on. */
  sms_available: boolean;
}

export type RestockPreferencesPatch = Partial<
  Pick<RestockPreferences, 'push' | 'whatsapp' | 'sms'>
>;

/** `null` when the item is in stock (no bell). */
export type RestockBellState = 'on' | 'off' | 'expired' | null;

export interface RestockAlertView {
  state: RestockBellState;
  enabled: boolean;
  expires_at: string | null;
}

/** Listing from GET /item-likes plus restock fields. */
export type RestockLikedItem = CatalogInventoryItem & {
  in_stock: boolean;
  back_in_stock: boolean;
  restocked_at: string | null;
  restock_alert: RestockAlertView;
};

export interface RestockLikesResponse {
  items: RestockLikedItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ItemAlertResult {
  item_id: string;
  enabled: boolean;
  state: 'armed' | 'sent' | 'disarmed';
  expires_at: string | null;
}

export type RestockLikesFilter = 'all' | 'back_in_stock';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

/** Server flag off for this market: every route but /status answers this. */
export const RESTOCK_DISABLED_CODE = 'restock_alerts_disabled';

export function isRestockDisabledError(e: unknown): boolean {
  const err = e as { code?: string; status?: number } | null;
  return err?.code === RESTOCK_DISABLED_CODE;
}

export async function getRestockPreferences(): Promise<RestockPreferences> {
  const res = await api.get<ApiEnvelope<RestockPreferences>>(
    '/restock-alerts/preferences'
  );
  return res.data;
}

export async function patchRestockPreferences(
  patch: RestockPreferencesPatch
): Promise<RestockPreferences> {
  const res = await api.patch<ApiEnvelope<RestockPreferences>>(
    '/restock-alerts/preferences',
    patch
  );
  return res.data;
}

/** Bell on/off. 404 `not_liked` when the item is not in the user's likes. */
export async function setItemAlert(
  itemId: string,
  enabled: boolean
): Promise<ItemAlertResult> {
  const res = await api.put<ApiEnvelope<ItemAlertResult>>(
    `/restock-alerts/items/${encodeURIComponent(itemId)}`,
    { enabled }
  );
  return res.data;
}

export async function getLikesWithAlerts(
  filter: RestockLikesFilter = 'all',
  page = 1,
  limit = 20
): Promise<RestockLikesResponse> {
  const res = await api.get<ApiEnvelope<RestockLikesResponse>>(
    `/restock-alerts/likes?filter=${filter}&page=${page}&limit=${limit}`
  );
  return res.data;
}

/**
 * Finds the liked listing (with bell state) for a catalog item id by paging
 * through the user's likes. Used by the item screen (no single-item read route
 * exists) and to resolve a push `/items/<catalogItemId>` link to a listing id.
 */
export async function findLikedRestockItem(
  catalogItemId: string,
  maxPages = 6
): Promise<RestockLikedItem | null> {
  for (let page = 1; page <= maxPages; page += 1) {
    const data = await getLikesWithAlerts('all', page, 50);
    const hit = data.items.find((i) => i.item_id === catalogItemId);
    if (hit) return hit;
    if (page >= data.totalPages) return null;
  }
  return null;
}

/** Public: the signed single-use token is the credential (push action). */
export async function stopRestockAlertsFromMessage(
  token: string
): Promise<{ channel: 'push' | 'whatsapp' | 'sms'; stopped: boolean }> {
  const res = await publicApiPost<
    ApiEnvelope<{ channel: 'push' | 'whatsapp' | 'sms'; stopped: boolean }>
  >('/restock-alerts/stop', { token });
  return res.data;
}
