import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApiClient } from './useApiClient';
import { useNotificationPreferences } from './useNotificationPreferences';

export interface BusinessReachabilityState {
  hasPush: boolean;
  whatsappReady: boolean;
  locationAlertPhoneSet: boolean | null;
  source: 'server' | 'fallback';
}

function fallbackState(prefs: ReturnType<typeof useNotificationPreferences>['prefs']) {
  const hasPush =
    typeof Notification !== 'undefined' &&
    Notification.permission === 'granted' &&
    prefs?.pushEnabled !== false;
  const whatsappReady =
    prefs?.whatsappEnabled === true &&
    prefs?.orderUpdates !== false &&
    prefs?.phoneNumberVerified === true &&
    !!prefs?.phoneNumber;
  return {
    hasPush,
    whatsappReady,
    locationAlertPhoneSet: null,
    source: 'fallback' as const,
  };
}

export function useBusinessReachability(enabled: boolean) {
  const apiClient = useApiClient();
  const { prefs, loading: prefsLoading } = useNotificationPreferences();
  const [state, setState] = useState<BusinessReachabilityState | null>(null);
  const [loading, setLoading] = useState(enabled);

  const refresh = useCallback(async () => {
    if (!enabled || !apiClient) {
      setLoading(false);
      return;
    }
    if (prefsLoading) return;
    setLoading(true);
    try {
      const response = await apiClient.get<BusinessReachabilityState>(
        '/notifications/business-reachability'
      );
      setState({
        hasPush: response.data.hasPush,
        whatsappReady: response.data.whatsappReady,
        locationAlertPhoneSet: response.data.locationAlertPhoneSet,
        source: 'server',
      });
    } catch (error: any) {
      if (error?.response?.status === 404) {
        setState(fallbackState(prefs));
      }
    } finally {
      setLoading(false);
    }
  }, [apiClient, enabled, prefs, prefsLoading]);

  useEffect(() => {
    if (!enabled || prefsLoading) {
      setLoading(enabled && prefsLoading);
      return;
    }
    void refresh();
  }, [enabled, prefsLoading, refresh]);

  return useMemo(
    () => ({
      reachability: state ?? fallbackState(prefs),
      loading,
      refresh,
    }),
    [loading, prefs, refresh, state]
  );
}
