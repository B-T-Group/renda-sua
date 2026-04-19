import { useAuth0 } from '@auth0/auth0-react';
import { useCallback } from 'react';
import { getOrCreateRsAnonymousId } from '../utils/rsAnonymousId';
import { useApiClient } from './useApiClient';

export const SITE_EVENT_SUBJECT_INVENTORY_ITEM = 'inventory_item';

export const SITE_EVENT_INVENTORY_BUY_NOW_CLICK =
  'inventory.cta.buy_now_click' as const;

export const SITE_EVENT_INVENTORY_ORDER_NOW_CLICK =
  'inventory.cta.order_now_click' as const;

export type SiteEventTypeV1 =
  | typeof SITE_EVENT_INVENTORY_BUY_NOW_CLICK
  | typeof SITE_EVENT_INVENTORY_ORDER_NOW_CLICK;

export type TrackInventoryCtaSiteEventInput = {
  eventType: SiteEventTypeV1;
  subjectType: typeof SITE_EVENT_SUBJECT_INVENTORY_ITEM;
  subjectId: string;
  metadata?: Record<string, unknown>;
};

export function useTrackSiteEvent() {
  const apiClient = useApiClient();
  const { isAuthenticated, user } = useAuth0();

  const trackSiteEvent = useCallback(
    async (payload: TrackInventoryCtaSiteEventInput) => {
      if (!apiClient) {
        return;
      }

      const headers: Record<string, string> = {};
      if (isAuthenticated && user?.sub) {
        headers['X-User-Id'] = user.sub;
      } else {
        headers['X-Anonymous-Id'] = getOrCreateRsAnonymousId();
      }

      try {
        await apiClient.post('/track-site-event', payload, { headers });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to track site event', error);
      }
    },
    [apiClient, isAuthenticated, user?.sub]
  );

  return { trackSiteEvent };
}
