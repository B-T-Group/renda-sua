import { useAuth0 } from '@auth0/auth0-react';
import { useCallback } from 'react';
import { getOrCreateRsAnonymousId } from '../utils/rsAnonymousId';
import { useApiClient } from './useApiClient';

export const SITE_EVENT_SUBJECT_INVENTORY_ITEM = 'inventory_item';

export const SITE_EVENT_INVENTORY_BUY_NOW_CLICK =
  'inventory.cta.buy_now_click' as const;

export const SITE_EVENT_INVENTORY_ORDER_NOW_CLICK =
  'inventory.cta.order_now_click' as const;

export const SITE_EVENT_INVENTORY_BROWSE_MORE_CLICK =
  'inventory.cta.browse_more_click' as const;

export const SITE_EVENT_INVENTORY_SEARCH_SUBMIT =
  'inventory.search.submit' as const;

export const SITE_EVENT_INVENTORY_SEARCH_SUGGESTION_SELECT =
  'inventory.search.suggestion_select' as const;

export const SITE_EVENT_INVENTORY_SORT_SELECT =
  'inventory.sort.select' as const;

export const SITE_EVENT_INVENTORY_FILTER_CHANGE =
  'inventory.filter.change' as const;

export const SITE_EVENT_INVENTORY_FILTER_CLEAR =
  'inventory.filter.clear' as const;

export const SITE_EVENT_INVENTORY_LOCATION_SELECT =
  'inventory.location.select' as const;

export const SITE_EVENT_INVENTORY_CARD_VIEW_DETAILS_CLICK =
  'inventory.card.view_details_click' as const;

export const SITE_EVENT_INVENTORY_CARD_IMAGE_LIGHTBOX_OPEN =
  'inventory.card.image_lightbox_open' as const;

export const SITE_EVENT_INVENTORY_CHECKOUT_DIALOG_OPEN =
  'inventory.checkout_dialog.open' as const;

export const SITE_EVENT_INVENTORY_CHECKOUT_DIALOG_CONTINUE_CLICK =
  'inventory.checkout_dialog.continue_click' as const;

export const SITE_EVENT_INVENTORY_CHECKOUT_DIALOG_AUTH_REDIRECT =
  'inventory.checkout_dialog.auth_redirect' as const;

export type SiteEventTypeV1 =
  | typeof SITE_EVENT_INVENTORY_BUY_NOW_CLICK
  | typeof SITE_EVENT_INVENTORY_ORDER_NOW_CLICK
  | typeof SITE_EVENT_INVENTORY_BROWSE_MORE_CLICK
  | typeof SITE_EVENT_INVENTORY_SEARCH_SUBMIT
  | typeof SITE_EVENT_INVENTORY_SEARCH_SUGGESTION_SELECT
  | typeof SITE_EVENT_INVENTORY_SORT_SELECT
  | typeof SITE_EVENT_INVENTORY_FILTER_CHANGE
  | typeof SITE_EVENT_INVENTORY_FILTER_CLEAR
  | typeof SITE_EVENT_INVENTORY_LOCATION_SELECT
  | typeof SITE_EVENT_INVENTORY_CARD_VIEW_DETAILS_CLICK
  | typeof SITE_EVENT_INVENTORY_CARD_IMAGE_LIGHTBOX_OPEN
  | typeof SITE_EVENT_INVENTORY_CHECKOUT_DIALOG_OPEN
  | typeof SITE_EVENT_INVENTORY_CHECKOUT_DIALOG_CONTINUE_CLICK
  | typeof SITE_EVENT_INVENTORY_CHECKOUT_DIALOG_AUTH_REDIRECT;

export type TrackInventoryCtaSiteEventInput = {
  eventType: SiteEventTypeV1;
  subjectType?: string;
  subjectId?: string;
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
