/** Keys exposed to mobile/web clients via GET /app-config/client-flags. */
export const CLIENT_FLAG_KEYS = [
  'reels_enabled',
  'reels_comments_enabled',
  'reels_merchant_allowlist_only',
  'floating_nav_enabled',
  'reorder_v1',
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
};
