import { normalizeCity, sameCountryAndState, type RegionRef } from '../common/same-region.util';

/**
 * #594 AC-E7 (PE): a posting is visible to an agent when the store's
 * `addresses.city` matches the agent's city, inside the same country and state.
 * City, state and country are compared normalised (case, accents, spacing:
 * "Douala " = "douala"). When either city is blank the state decides
 * (`state_fallback`); callers log those so a blank city can be fixed.
 */
export type PostingCityBasis = 'city' | 'state_fallback';
export type PostingCityMiss = 'country_or_state' | 'city';

export type PostingCityMatch =
  | { match: true; basis: PostingCityBasis }
  | { match: false; miss: PostingCityMiss };

export function matchPostingCity(agent: RegionRef, store: RegionRef): PostingCityMatch {
  if (!sameCountryAndState(agent, store)) return { match: false, miss: 'country_or_state' };
  const agentCity = normalizeCity(agent.city);
  const storeCity = normalizeCity(store.city);
  if (agentCity === '' || storeCity === '') return { match: true, basis: 'state_fallback' };
  return agentCity === storeCity ? { match: true, basis: 'city' } : { match: false, miss: 'city' };
}

export interface AgentAddressRow {
  address?: {
    city?: string | null;
    state?: string | null;
    country?: string | null;
    latitude?: number | string | null;
    longitude?: number | string | null;
    is_primary?: boolean | null;
  } | null;
}

/**
 * The agent's address for matching: the active primary one, else the oldest
 * active one (rows come ordered by address.created_at asc), as
 * AgentHoldService.resolveAgentCity does for the hold-ceiling pilot city.
 */
export function pickAgentAddress(rows: AgentAddressRow[] | null | undefined): AgentAddressRow['address'] | null {
  const list = (rows ?? []).map((r) => r.address).filter((a): a is NonNullable<AgentAddressRow['address']> => !!a);
  return list.find((a) => a.is_primary === true) ?? list[0] ?? null;
}
