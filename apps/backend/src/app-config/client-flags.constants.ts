/** Keys exposed to mobile/web clients via GET /app-config/client-flags. */
export const CLIENT_FLAG_KEYS = [
  'reels_enabled',
  'reels_comments_enabled',
  'reels_merchant_allowlist_only',
  'floating_nav_enabled',
  'reorder_v1',
  'auth_web_inapp_gates',
  'auth_gate_ul_fallback',
  'catalog_experience_v1',
  'assistant_launcher_v1',
  'assistant_shopping_v1',
  'assistant_rentals_enabled',
  'rentals_card_charge_at_pickup_enabled',
  'restock_alerts_v1',
  'discovery_sort_v1',
  'agent_contract_required',
  'rentals_search_first_enabled',
  'rentals_modify_request_enabled',
  'rentals_my_rentals_entry_enabled',
  'rentals_client_tab_enabled',
  'rentals_not_received_report_enabled',
  'rentals_renter_return_report_enabled',
  'rentals_card_window_guard_enabled',
  'rentals_pickup_photo_rules_enabled',
] as const;

export type ClientFlagKey = (typeof CLIENT_FLAG_KEYS)[number];

export type ClientFlags = Record<ClientFlagKey, boolean>;

const isNonProduction = process.env.NODE_ENV !== 'production';

export const DEFAULT_CLIENT_FLAGS: ClientFlags = {
  reels_enabled: false,
  reels_comments_enabled: false,
  reels_merchant_allowlist_only: false,
  floating_nav_enabled: false,
  /** On in non-production when no DB row exists; off in production until configured. */
  reorder_v1: isNonProduction,
  /** Off by default for a 2-week baseline before enabling in-app auth gates. */
  auth_web_inapp_gates: false,
  /**
   * "Sign in with password" (Auth0 Universal Login) link inside the in-app gate (#338 soak).
   * Only rendered where auth_web_inapp_gates is on, so defaulting true is safe.
   */
  auth_gate_ul_fallback: true,
  /** On in non-production when no DB row exists; off in production until configured. */
  catalog_experience_v1: isNonProduction,
  /** Shopping assistant launcher (orb, nudge, chips) - default off until Phase 0b. */
  assistant_launcher_v1: false,
  /** Shopping assistant catalog tools (search_catalog, get_reorder_options) - per market. */
  assistant_shopping_v1: false,
  /** Assistant rental search, quotes and cards. Off until a row turns it on. No NODE_ENV override. */
  assistant_rentals_enabled: false,
  /** Card rentals charged at pickup skip the 6-day authorization window. Off until a row turns it on. */
  rentals_card_charge_at_pickup_enabled: false,
  /** Restock alerts for liked items (#343): bell, Likes 'Back in stock', settings row. */
  restock_alerts_v1: false,
  /** Discovery sort modes, rating trust signal and empty-result recovery (#342). Per market. */
  discovery_sort_v1: false,
  /** Agents must sign a BoldSign agreement before they can claim orders. */
  agent_contract_required: true,
  /** Search-first client rentals. Off until a country row turns it on. */
  rentals_search_first_enabled: false,
  /** Renter edits of a Requested rental. Off until a row turns it on. */
  rentals_modify_request_enabled: false,
  /** My rentals header and Next rental card on the search-first landing. Off until a row turns it on. */
  rentals_my_rentals_entry_enabled: false,
  /** Client Rentals tab. Off until a country or global row turns it on. No NODE_ENV override. */
  rentals_client_tab_enabled: false,
  /** Renter "didn't receive the item" report. Off until a row turns it on. No NODE_ENV override. */
  rentals_not_received_report_enabled: false,
  /** Renter "I've returned it" report. Off until a row turns it on. No NODE_ENV override. */
  rentals_renter_return_report_enabled: false,
  /** Date picker and create-time card window guard. Off until a row turns it on. No NODE_ENV override. */
  rentals_card_window_guard_enabled: false,
  /** Pickup-day camera, server timestamp, and last-return guide. Off until a row turns it on. No NODE_ENV override. */
  rentals_pickup_photo_rules_enabled: false,
};
