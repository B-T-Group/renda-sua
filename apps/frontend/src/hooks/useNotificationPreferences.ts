import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface NotificationPreferences {
  userId: string;
  pushEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  whatsappOptedInAt: string | null;
  whatsappInformationalEnabled: boolean;
  marketingEnabled: boolean;
  orderUpdates: boolean;
  chat: boolean;
  marketplace: boolean;
  reminders: boolean;
  phoneNumber: string | null;
  phoneNumberVerified: boolean;
}

export type NotificationPreferencesPatch = Partial<
  Pick<
    NotificationPreferences,
    | 'pushEnabled'
    | 'emailEnabled'
    | 'smsEnabled'
    | 'whatsappEnabled'
    | 'whatsappInformationalEnabled'
    | 'marketingEnabled'
    | 'orderUpdates'
    | 'chat'
    | 'marketplace'
    | 'reminders'
  >
>;

export function useNotificationPreferences() {
  const apiClient = useApiClient();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get<NotificationPreferences>(
        '/notifications/preferences'
      );
      setPrefs(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load preferences');
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const update = useCallback(
    async (patch: NotificationPreferencesPatch) => {
      setSaving(true);
      setError(null);
      try {
        const { data } = await apiClient.patch<NotificationPreferences>(
          '/notifications/preferences',
          patch
        );
        setPrefs(data);
        return data;
      } catch (e: any) {
        const message =
          e?.response?.data?.message ||
          e?.message ||
          'Failed to update preferences';
        setError(Array.isArray(message) ? message.join(', ') : message);
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [apiClient]
  );

  return { prefs, loading, saving, error, refresh, update };
}
