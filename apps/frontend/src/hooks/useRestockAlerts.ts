import { useEffect, useMemo, useState } from 'react';
import { useSessionAuth } from '../contexts/SessionAuthContext';
import { useApiClient } from './useApiClient';
import { useClientFlags } from './useClientFlags';

export interface RestockAlertPreferences {
  push: boolean;
  whatsapp: boolean;
  sms: boolean;
  whatsapp_available: boolean;
  sms_available: boolean;
}

export interface ItemAlertState {
  /** 'on' = bell filled, 'off' = bell muted, 'expired' = outline, null = in stock (no bell). */
  state: 'on' | 'off' | 'expired' | null;
  enabled: boolean;
  expires_at: string | null;
}

export interface RestockLikesResponse {
  items: any[];
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

/** Bell state shown after PUT /restock-alerts/items/:id (`armed` = bell on). */
export function alertStateFromResult(result: ItemAlertResult): ItemAlertState {
  const on = result.enabled && result.state !== 'disarmed';
  return {
    state: on ? 'on' : 'off',
    enabled: on,
    expires_at: result.expires_at,
  };
}

/** A bell is "on" only when the backend says `state: 'on'` (expired rows keep enabled=true). */
export function isAlertOn(alert: ItemAlertState | null | undefined): boolean {
  return alert?.state === 'on';
}

/** Plain REST calls to /restock-alerts/*. No state, no network on mount. */
export function useRestockAlertsApi() {
  const apiClient = useApiClient();

  return useMemo(
    () => ({
      getPreferences: async () => {
        const { data } = await apiClient.get<{
          success: boolean;
          data: RestockAlertPreferences;
        }>('/restock-alerts/preferences');
        return data.data;
      },
      patchPreferences: async (patch: {
        push?: boolean;
        whatsapp?: boolean;
        sms?: boolean;
      }) => {
        const { data } = await apiClient.patch<{
          success: boolean;
          data: RestockAlertPreferences;
        }>('/restock-alerts/preferences', patch);
        return data.data;
      },
      /** `itemId` is the catalog item id (`items.id`), not the listing id. */
      setItemAlert: async (itemId: string, enabled: boolean) => {
        const { data } = await apiClient.put<{
          success: boolean;
          data: ItemAlertResult;
        }>(`/restock-alerts/items/${itemId}`, { enabled });
        return data.data;
      },
      getLikes: async (
        filter: 'all' | 'back_in_stock' = 'all',
        page = 1,
        limit = 20
      ) => {
        const { data } = await apiClient.get<{
          success: boolean;
          data: RestockLikesResponse;
        }>('/restock-alerts/likes', { params: { filter, page, limit } });
        return data.data;
      },
      /** PUT /item-likes/:itemId (same call the heart makes). */
      likeItem: async (itemId: string) => {
        await apiClient.put(`/item-likes/${itemId}`, { liked: true });
      },
    }),
    [apiClient]
  );
}

const STATUS_TTL_MS = 60_000;
let statusCache: { at: number; enabled: boolean } | null = null;
let statusInflight: Promise<boolean> | null = null;

/** Test helper. */
export function __resetRestockStatusCache(): void {
  statusCache = null;
  statusInflight = null;
}

/**
 * Is restock alerts v1 on for this user?
 * `null` while unknown. Requires the `restock_alerts_v1` client flag AND a signed-in
 * user; with the flag off or signed out nothing is requested and `enabled` is `false`.
 */
export function useRestockAlertsEnabled(): {
  enabled: boolean | null;
  flagOn: boolean;
} {
  const apiClient = useApiClient();
  const { isAuthenticated } = useSessionAuth();
  const { flags, loaded } = useClientFlags();
  const flagOn = flags.restock_alerts_v1 === true;
  const active = flagOn && isAuthenticated;
  const [status, setStatus] = useState<boolean | null>(() =>
    statusCache && Date.now() - statusCache.at < STATUS_TTL_MS
      ? statusCache.enabled
      : null
  );

  useEffect(() => {
    if (!active || !apiClient) return undefined;
    if (statusCache && Date.now() - statusCache.at < STATUS_TTL_MS) {
      setStatus(statusCache.enabled);
      return undefined;
    }
    let cancelled = false;
    if (!statusInflight) {
      statusInflight = apiClient
        .get<{ success: boolean; data: { enabled: boolean } }>(
          '/restock-alerts/status'
        )
        .then((res) => {
          const enabled = res.data?.data?.enabled === true;
          statusCache = { at: Date.now(), enabled };
          return enabled;
        })
        .catch(() => false)
        .finally(() => {
          statusInflight = null;
        });
    }
    void statusInflight.then((enabled) => {
      if (!cancelled) setStatus(enabled);
    });
    return () => {
      cancelled = true;
    };
  }, [active, apiClient]);

  if (!active) {
    // Flag still loading counts as unknown so callers can wait instead of flashing.
    return { enabled: loaded || !isAuthenticated ? false : null, flagOn };
  }
  return { enabled: status, flagOn };
}
