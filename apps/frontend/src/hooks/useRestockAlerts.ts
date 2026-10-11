import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

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

export function useRestockAlerts() {
  const apiClient = useApiClient();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void checkEnabled();
  }, []);

  const checkEnabled = useCallback(async () => {
    try {
      const { data } = await apiClient.get<{ success: boolean; data: { enabled: boolean } }>(
        '/restock-alerts/status'
      );
      setEnabled(data.data.enabled);
    } catch {
      setEnabled(false);
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  const getPreferences = useCallback(async () => {
    const { data } = await apiClient.get<{ success: boolean; data: RestockAlertPreferences }>(
      '/restock-alerts/preferences'
    );
    return data.data;
  }, [apiClient]);

  const patchPreferences = useCallback(
    async (patch: { push?: boolean; whatsapp?: boolean; sms?: boolean }) => {
      const { data } = await apiClient.patch<{ success: boolean; data: RestockAlertPreferences }>(
        '/restock-alerts/preferences',
        patch
      );
      return data.data;
    },
    [apiClient]
  );

  const setItemAlert = useCallback(
    async (itemId: string, enabled: boolean) => {
      const { data } = await apiClient.put<{
        success: boolean;
        data: { item_id: string; enabled: boolean; state: string; expires_at: string | null };
      }>(`/restock-alerts/items/${itemId}`, { enabled });
      return data.data;
    },
    [apiClient]
  );

  const getLikes = useCallback(
    async (filter: 'all' | 'back_in_stock' = 'all', page = 1, limit = 20) => {
      const { data } = await apiClient.get<{ success: boolean; data: RestockLikesResponse }>(
        '/restock-alerts/likes',
        { params: { filter, page, limit } }
      );
      return data.data;
    },
    [apiClient]
  );

  return {
    enabled,
    loading,
    checkEnabled,
    getPreferences,
    patchPreferences,
    setItemAlert,
    getLikes,
  };
}
