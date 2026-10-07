import { useSessionAuth } from '../contexts/SessionAuthContext';
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

export const SITE_EVENT_INVENTORY_FAQ_TOGGLE =
  'inventory.cta.faq_toggle' as const;

export const SITE_EVENT_INVENTORY_RATING_SUMMARY_CLICK =
  'inventory.cta.rating_summary_click' as const;

export const SITE_EVENT_INVENTORY_CONTACT_BEFORE_BUY_CLICK =
  'inventory.cta.contact_before_buy_click' as const;

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

// Delivery availability funnel (reason-blind on the client):
// unavailable shown -> switched to pickup -> pickup order created.
export const SITE_EVENT_CHECKOUT_DELIVERY_UNAVAILABLE_SHOWN =
  'checkout.delivery_unavailable_shown' as const;

export const SITE_EVENT_CHECKOUT_SWITCHED_TO_PICKUP =
  'checkout.switched_to_pickup' as const;

export const SITE_EVENT_CHECKOUT_ORDER_CREATED_PICKUP =
  'checkout.order_created_pickup' as const;

// PDP Delivery Expectations Card events
export const SITE_EVENT_DELIVERY_CARD_VIEW =
  'inventory.delivery_card.view' as const;

export const SITE_EVENT_DELIVERY_CARD_AREA_PROMPT_CLICK =
  'inventory.delivery_card.area_prompt_click' as const;

export const SITE_EVENT_DELIVERY_CARD_ESTIMATE_READY =
  'inventory.delivery_card.estimate_ready' as const;

export const SITE_EVENT_ORDERS_REORDER_IMPRESSION =
  'orders.reorder.impression' as const;
export const SITE_EVENT_ORDERS_REORDER_TAP = 'orders.reorder.tap' as const;
export const SITE_EVENT_ORDERS_REORDER_RESULT =
  'orders.reorder.result' as const;

export const SITE_EVENT_AUTH_GATE_SHOWN = 'auth_gate_shown' as const;
export const SITE_EVENT_AUTH_GATE_DISMISSED = 'auth_gate_dismissed' as const;
export const SITE_EVENT_AUTH_CODE_SENT = 'auth_code_sent' as const;
export const SITE_EVENT_AUTH_CODE_SEND_FAILED = 'auth_code_send_failed' as const;
export const SITE_EVENT_AUTH_CODE_FAILED = 'auth_code_failed' as const;
export const SITE_EVENT_AUTH_LOCKED = 'auth_locked' as const;
export const SITE_EVENT_AUTH_CODE_VERIFIED = 'auth_code_verified' as const;
export const SITE_EVENT_AUTH_INTENT_COMPLETED = 'auth_intent_completed' as const;
export const SITE_EVENT_AUTH_PASSWORD_USED = 'auth_password_used' as const;
export const SITE_EVENT_AUTH_UL_FALLBACK_USED = 'auth_ul_fallback_used' as const;
export const SITE_EVENT_AUTH_REAUTH_NOTICE_SHOWN =
  'auth_reauth_notice_shown' as const;
export const SITE_EVENT_AUTH_REAUTH_NOTICE_ACTION =
  'auth_reauth_notice_action' as const;
export const SITE_EVENT_AUTH_SESSION_OBSERVED = 'auth_session_observed' as const;

export const SITE_EVENT_CATALOG_MODULE_IMPRESSION =
  'catalog.module.impression' as const;
export const SITE_EVENT_CATALOG_MODULE_CLICK =
  'catalog.module.click' as const;

// Assistant launcher (#451 §3.3; types allowlisted by #458).
export const SITE_EVENT_ASSISTANT_LAUNCHER_IMPRESSION =
  'assistant.launcher.impression' as const;
export const SITE_EVENT_ASSISTANT_LAUNCHER_TAP = 'assistant.launcher.tap' as const;
export const SITE_EVENT_ASSISTANT_NUDGE_SHOWN = 'assistant.nudge.shown' as const;
export const SITE_EVENT_ASSISTANT_NUDGE_DISMISSED =
  'assistant.nudge.dismissed' as const;
export const SITE_EVENT_ASSISTANT_ATTENTION_PLAYED =
  'assistant.attention.played' as const;

// Assistant chat funnel (#451 Phase 0).
export const SITE_EVENT_ASSISTANT_CHAT_OPENED = 'assistant.chat.opened' as const;
export const SITE_EVENT_ASSISTANT_MESSAGE_SENT = 'assistant.message.sent' as const;
export const SITE_EVENT_ASSISTANT_CHIP_TAP = 'assistant.chip.tap' as const;
export const SITE_EVENT_ASSISTANT_DEEPLINK_SHOWN = 'assistant.deeplink.shown' as const;
export const SITE_EVENT_ASSISTANT_DEEPLINK_TAP = 'assistant.deeplink.tap' as const;
export const SITE_EVENT_ASSISTANT_HANDOFF_REQUESTED = 'assistant.handoff.requested' as const;
export const SITE_EVENT_ASSISTANT_ERROR_SHOWN = 'assistant.error.shown' as const;

export type SiteEventTypeV1 =
  | typeof SITE_EVENT_INVENTORY_BUY_NOW_CLICK
  | typeof SITE_EVENT_INVENTORY_ORDER_NOW_CLICK
  | typeof SITE_EVENT_INVENTORY_BROWSE_MORE_CLICK
  | typeof SITE_EVENT_INVENTORY_FAQ_TOGGLE
  | typeof SITE_EVENT_INVENTORY_RATING_SUMMARY_CLICK
  | typeof SITE_EVENT_INVENTORY_CONTACT_BEFORE_BUY_CLICK
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
  | typeof SITE_EVENT_INVENTORY_CHECKOUT_DIALOG_AUTH_REDIRECT
  | typeof SITE_EVENT_CHECKOUT_DELIVERY_UNAVAILABLE_SHOWN
  | typeof SITE_EVENT_CHECKOUT_SWITCHED_TO_PICKUP
  | typeof SITE_EVENT_CHECKOUT_ORDER_CREATED_PICKUP
  | typeof SITE_EVENT_DELIVERY_CARD_VIEW
  | typeof SITE_EVENT_DELIVERY_CARD_AREA_PROMPT_CLICK
  | typeof SITE_EVENT_DELIVERY_CARD_ESTIMATE_READY
  | typeof SITE_EVENT_ORDERS_REORDER_IMPRESSION
  | typeof SITE_EVENT_ORDERS_REORDER_TAP
  | typeof SITE_EVENT_ORDERS_REORDER_RESULT
  | typeof SITE_EVENT_AUTH_GATE_SHOWN
  | typeof SITE_EVENT_AUTH_GATE_DISMISSED
  | typeof SITE_EVENT_AUTH_CODE_SENT
  | typeof SITE_EVENT_AUTH_CODE_SEND_FAILED
  | typeof SITE_EVENT_AUTH_CODE_FAILED
  | typeof SITE_EVENT_AUTH_LOCKED
  | typeof SITE_EVENT_AUTH_CODE_VERIFIED
  | typeof SITE_EVENT_AUTH_INTENT_COMPLETED
  | typeof SITE_EVENT_AUTH_PASSWORD_USED
  | typeof SITE_EVENT_AUTH_UL_FALLBACK_USED
  | typeof SITE_EVENT_AUTH_REAUTH_NOTICE_SHOWN
  | typeof SITE_EVENT_AUTH_REAUTH_NOTICE_ACTION
  | typeof SITE_EVENT_AUTH_SESSION_OBSERVED
  | typeof SITE_EVENT_CATALOG_MODULE_IMPRESSION
  | typeof SITE_EVENT_CATALOG_MODULE_CLICK
  | typeof SITE_EVENT_ASSISTANT_LAUNCHER_IMPRESSION
  | typeof SITE_EVENT_ASSISTANT_LAUNCHER_TAP
  | typeof SITE_EVENT_ASSISTANT_NUDGE_SHOWN
  | typeof SITE_EVENT_ASSISTANT_NUDGE_DISMISSED
  | typeof SITE_EVENT_ASSISTANT_ATTENTION_PLAYED
  | typeof SITE_EVENT_ASSISTANT_CHAT_OPENED
  | typeof SITE_EVENT_ASSISTANT_MESSAGE_SENT
  | typeof SITE_EVENT_ASSISTANT_CHIP_TAP
  | typeof SITE_EVENT_ASSISTANT_DEEPLINK_SHOWN
  | typeof SITE_EVENT_ASSISTANT_DEEPLINK_TAP
  | typeof SITE_EVENT_ASSISTANT_HANDOFF_REQUESTED
  | typeof SITE_EVENT_ASSISTANT_ERROR_SHOWN;

export type TrackInventoryCtaSiteEventInput = {
  eventType: SiteEventTypeV1;
  subjectType?: string;
  subjectId?: string;
  metadata?: Record<string, unknown>;
};

export type TrackSiteEventOptions = {
  /**
   * Guest identity override. Assistant events from guests are keyed by the chat
   * thread id instead of the stable per-install id (#451 §3.3, §7b.9 Q2); an empty
   * value sends no anonymous id (the server falls back to ip|ua).
   */
  anonymousId?: string | null;
};

export function useTrackSiteEvent() {
  const apiClient = useApiClient();
  const { isAuthenticated, user } = useSessionAuth();

  const trackSiteEvent = useCallback(
    async (
      payload: TrackInventoryCtaSiteEventInput,
      options?: TrackSiteEventOptions
    ) => {
      if (!apiClient) {
        return;
      }

      const headers: Record<string, string> = {};
      if (isAuthenticated && user?.sub) {
        headers['X-User-Id'] = user.sub;
      } else if (options && 'anonymousId' in options) {
        if (options.anonymousId) headers['X-Anonymous-Id'] = options.anonymousId;
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
