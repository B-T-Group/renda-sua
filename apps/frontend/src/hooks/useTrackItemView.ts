import { useAuth0 } from '@auth0/auth0-react';
import { useCallback, useRef } from 'react';
import { getOrCreateRsAnonymousId } from '../utils/rsAnonymousId';
import { useApiClient } from './useApiClient';

export type TrackItemViewOptions = {
  eventId?: string;
  value?: number;
  currency?: string;
  contentName?: string;
};

export const useTrackItemView = (inventoryItemId: string | null) => {
  const apiClient = useApiClient();
  const { isAuthenticated, user } = useAuth0();
  const hasTrackedRef = useRef<Record<string, boolean>>({});
  const metaViewTrackedRef = useRef<Record<string, boolean>>({});

  const trackView = useCallback(
    async (overrideItemId?: string, options?: TrackItemViewOptions) => {
      const itemId = overrideItemId ?? inventoryItemId;
      if (!itemId || !apiClient) {
        return;
      }

      const wantsMeta = !!options?.eventId?.trim();
      if (wantsMeta) {
        if (metaViewTrackedRef.current[itemId]) return;
        metaViewTrackedRef.current[itemId] = true;
      } else if (hasTrackedRef.current[itemId]) {
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
          {
            itemId,
            ...(options?.eventId && { eventId: options.eventId }),
            ...(options?.value != null && { value: options.value }),
            ...(options?.currency && { currency: options.currency }),
            ...(options?.contentName && { contentName: options.contentName }),
          },
          { headers }
        );
      } catch (error) {
        hasTrackedRef.current[itemId] = false;
        if (wantsMeta) metaViewTrackedRef.current[itemId] = false;
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
