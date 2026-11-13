import { publicApiGet } from './publicApiClient';

export type ClientFlagKey =
  | 'reels_enabled'
  | 'reels_comments_enabled'
  | 'reels_merchant_allowlist_only'
  | 'floating_nav_enabled'
  | 'reorder_v1'
  | 'catalog_experience_v1'
  | 'assistant_launcher_v1'
  | 'assistant_shopping_v1'
  | 'assistant_rentals_enabled'
  | 'rentals_card_charge_at_pickup_enabled'
  | 'restock_alerts_v1'
  | 'discovery_sort_v1'
  | 'agent_contract_required'
  | 'rentals_search_first_enabled'
  | 'rentals_modify_request_enabled'
  | 'rentals_my_rentals_entry_enabled'
  | 'rentals_client_tab_enabled'
  | 'rentals_not_received_report_enabled'
  | 'rentals_renter_return_report_enabled'
  | 'rentals_card_window_guard_enabled';

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
  assistant_rentals_enabled: false,
  /** Card charge at pickup. Off until a config row turns it on. */
  rentals_card_charge_at_pickup_enabled: false,
  /** Restock alerts for liked items (#343). Backend default off. */
  restock_alerts_v1: false,
  /** Discovery sort modes + empty-result recovery (#342). Backend default off. */
  discovery_sort_v1: false,
  agent_contract_required: true,
  /** Search-first client rentals. Off until UX accepts the new landing. */
  rentals_search_first_enabled: false,
  /** Renter edits of a Requested rental. Off until a config row turns it on. */
  rentals_modify_request_enabled: false,
  /** My rentals header and Next rental card. Off until a config row turns it on. */
  rentals_my_rentals_entry_enabled: false,
  /** Client Rentals tab. Off until a config row turns it on. */
  rentals_client_tab_enabled: false,
  /** Renter report that the item was not received. Off until a config row turns it on. */
  rentals_not_received_report_enabled: false,
  /** Renter "I've returned it" report. Off until a config row turns it on. */
  rentals_renter_return_report_enabled: false,
  /** Card date guard. Off until a config row turns it on. No NODE_ENV override. */
  rentals_card_window_guard_enabled: false,
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
