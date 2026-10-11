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
  'restock_alerts_v1',
  'discovery_sort_v1',
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
  /** Restock alerts for liked items (#343): bell, Likes 'Back in stock', settings row. */
  restock_alerts_v1: false,
  /** Discovery sort modes, rating trust signal and empty-result recovery (#342). Per market. */
  discovery_sort_v1: false,
};
