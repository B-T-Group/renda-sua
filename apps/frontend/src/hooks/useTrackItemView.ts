import { useAuth0 } from '@auth0/auth0-react';
import { useCallback, useRef } from 'react';
import { getOrCreateRsAnonymousId } from '../utils/rsAnonymousId';
import { useApiClient } from './useApiClient';

export const useTrackItemView = (inventoryItemId: string | null) => {
  const apiClient = useApiClient();
  const { isAuthenticated, user } = useAuth0();
  const hasTrackedRef = useRef<Record<string, boolean>>({});

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
        headers['X-Anonymous-Id'] = getOrCreateRsAnonymousId();
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
    [apiClient, inventoryItemId, isAuthenticated, user?.sub]
  );

  const trackOnMount = useCallback(() => {
    void trackView();
  }, [trackView]);

  return {
    trackOnMount,
    trackView,
  };
};

