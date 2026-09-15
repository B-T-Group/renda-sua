import { publicApiGet } from './publicApiClient';

export type ClientFlagKey =
  | 'reels_enabled'
  | 'reels_comments_enabled'
  | 'reels_merchant_allowlist_only'
  | 'floating_nav_enabled';

export type ClientFlags = Record<ClientFlagKey, boolean>;

export const DEFAULT_CLIENT_FLAGS: ClientFlags = {
  reels_enabled: false,
  reels_comments_enabled: false,
  reels_merchant_allowlist_only: false,
  floating_nav_enabled: false,
};

type ClientFlagsResponse = {
  success: boolean;
  data: ClientFlags;
  message: string;
};

export async function fetchClientFlags(
  country?: string,
  init?: { signal?: AbortSignal }
): Promise<ClientFlags> {
  try {
    const res = await publicApiGet<ClientFlagsResponse>(
      '/app-config/client-flags',
      country ? { country } : undefined,
      init
    );
    return { ...DEFAULT_CLIENT_FLAGS, ...res.data };
  } catch {
    return DEFAULT_CLIENT_FLAGS;
  }
}
