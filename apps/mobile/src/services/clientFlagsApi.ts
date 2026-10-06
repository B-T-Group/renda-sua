import { publicApiGet } from './publicApiClient';

export type ClientFlagKey =
  | 'reels_enabled'
  | 'reels_comments_enabled'
  | 'reels_merchant_allowlist_only'
  | 'floating_nav_enabled'
  | 'reorder_v1'
  | 'catalog_experience_v1'
  | 'assistant_launcher_v1'
  | 'assistant_shopping_v1';

export type ClientFlags = Record<ClientFlagKey, boolean>;

export const DEFAULT_CLIENT_FLAGS: ClientFlags = {
  reels_enabled: false,
  reels_comments_enabled: false,
  reels_merchant_allowlist_only: false,
  floating_nav_enabled: false,
  /** Backend defaults on in non-production; keep false until flags load. */
  reorder_v1: false,
  catalog_experience_v1: false,
  assistant_launcher_v1: false,
  assistant_shopping_v1: false,
};

type ClientFlagsResponse = {
  success: boolean;
  data: ClientFlags;
  message: string;
};

export type ClientFlagsFetchResult =
  | { ok: true; flags: ClientFlags }
  | { ok: false; error: unknown };

/**
 * Fetches client flags for an optional market (ISO-2). Never throws: failures
 * come back as `{ ok: false }` so callers can keep their last known flags
 * instead of falling back to all-false defaults mid-session.
 */
export async function fetchClientFlags(
  country?: string,
  init?: { signal?: AbortSignal }
): Promise<ClientFlagsFetchResult> {
  try {
    const res = await publicApiGet<ClientFlagsResponse>(
      '/app-config/client-flags',
      country ? { country } : undefined,
      init
    );
    if (!res || typeof res.data !== 'object' || res.data === null) {
      return { ok: false, error: new Error('Malformed client flags response') };
    }
    return { ok: true, flags: { ...DEFAULT_CLIENT_FLAGS, ...res.data } };
  } catch (error) {
    return { ok: false, error };
  }
}
