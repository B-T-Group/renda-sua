import { useAuth0 } from '@auth0/auth0-react';
import { useCallback, useRef } from 'react';
import { useApiClient } from './useApiClient';

const ANON_ID_STORAGE_KEY = 'rs_anon_id';

export const useTrackItemView = (inventoryItemId: string | null) => {
  const apiClient = useApiClient();
  const { isAuthenticated, user } = useAuth0();
  const hasTrackedRef = useRef<Record<string, boolean>>({});

  const getAnonymousId = useCallback((): string => {
    try {
      const existing = window.localStorage.getItem(ANON_ID_STORAGE_KEY);
      if (existing) {
        return existing;
      }
      const generated = crypto.randomUUID();
      window.localStorage.setItem(ANON_ID_STORAGE_KEY, generated);
      return generated;
    } catch {
      return `anon-${Math.random().toString(36).slice(2)}`;
    }
  }, []);

  const trackView = useCallback(
    async (overrideItemId?: string) => {
      const itemId = overrideItemId ?? inventoryItemId;
      if (!itemId || !apiClient) {
        return;
      }

      if (hasTrackedRef.current[itemId]) {
        return;
      }
      hasTrackedRef.current[itemId] = true;

      const headers: Record<string, string> = {};

      if (isAuthenticated && user?.sub) {
        headers['X-User-Id'] = user.sub;
      } else {
        headers['X-Anonymous-Id'] = getAnonymousId();
      }

      try {
        await apiClient.post(
          '/track-view',
          { itemId },
          { headers }
        );
      } catch (error) {
        // Swallow tracking errors to avoid impacting UX
        // eslint-disable-next-line no-console
        console.error('Failed to track item view', error);
      }
    },
    [apiClient, getAnonymousId, inventoryItemId, isAuthenticated, user?.sub]
  );

  const trackOnMount = useCallback(() => {
    void trackView();
  }, [trackView]);

  return {
    trackOnMount,
    trackView,
  };
};

