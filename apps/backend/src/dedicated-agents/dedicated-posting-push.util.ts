import { showsDeliveryChrome } from '../agents/agent-focus.util';
import { agentPrefersAllSlots, slotPrefsFromRow, type AgentSlotPrefRow } from './agent-slot-prefs.util';
import { matchPostingCity, pickAgentAddress, type AgentAddressRow } from './dedicated-posting-city.util';

export interface PostingPushCandidate extends AgentSlotPrefRow {
  id: string;
  user_id: string | null;
  status?: string | null;
  focus?: string | null;
  is_verified?: boolean | null;
  is_internal?: boolean | null;
  user?: { preferred_language: string | null } | null;
  agent_addresses?: AgentAddressRow[] | null;
}

export type PostingPushSkip = 'no_user' | 'ineligible' | 'slots' | 'no_address' | 'city';

/**
 * #594 AC-P13: does a new posting push go to this agent? Same gates as the
 * opportunities list (AC-A1 minus the contract gate, checked by the caller),
 * the agent's address in the store's city (AC-E7), and ALL posting slots ON.
 */
export function postingPushSkipReason(
  agent: PostingPushCandidate,
  store: { city?: string | null; state?: string | null; country?: string | null },
  slotKeys: readonly string[]
): PostingPushSkip | null {
  if (!agent.user_id) return 'no_user';
  if (agent.status === 'suspended' || agent.is_internal === true || agent.is_verified !== true || !showsDeliveryChrome(agent.focus ?? null)) {
    return 'ineligible';
  }
  if (!agentPrefersAllSlots(slotPrefsFromRow(agent), slotKeys)) return 'slots';
  const address = pickAgentAddress(agent.agent_addresses);
  if (!address?.country?.trim()) return 'no_address';
  if (!matchPostingCity(address, store).match) return 'city';
  return null;
}
