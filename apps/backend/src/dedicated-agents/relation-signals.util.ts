import { samePhone } from '../orders/pay-after-retry.util';

/**
 * #594 AC-S5 possible-relation badge between an independent agent and the
 * business of a dedicated assignment. Non-blocking: a badge for the super user.
 *
 * Signals:
 * - `shared_phone`: any agent phone (account phone, MoMo phone) equals any
 *   business phone (owner and active-delegate account phones, location phone,
 *   order-alert phone, location MoMo phone). Compared with `samePhone`, so
 *   "+237 6xx", "2376xx" and "06xx" forms match on the subscriber digits.
 * - `referral_link`: the business was referred by this agent, or the agent was
 *   referred by this business.
 * - `shared_device` is reserved in the type but never emitted: no device ids
 *   are stored (mobile_push_tokens holds only user_id + Expo token), PE call.
 */
export type RelationSignal = 'shared_phone' | 'shared_device' | 'referral_link';

export interface RelationInput {
  agentId: string;
  isInternal: boolean;
  agentPhones: Array<string | null | undefined>;
  businessId: string;
  businessPhones: Array<string | null | undefined>;
  businessReferredByAgentId: string | null | undefined;
  agentReferredByBusinessId: string | null | undefined;
  dismissedAt: string | null | undefined;
}

export interface RelationBadge {
  possible_relation: boolean;
  relation_signals: RelationSignal[];
  relation_dismissed: boolean;
}

export function relationSignals(input: RelationInput): RelationSignal[] {
  // AC-S5 is about independents; internal agents are staff.
  if (input.isInternal) return [];
  const signals: RelationSignal[] = [];
  // samePhone already treats null/blank/digit-less values as "no match".
  if (input.agentPhones.some((a) => input.businessPhones.some((b) => samePhone(a, b)))) signals.push('shared_phone');
  if (
    (!!input.businessReferredByAgentId && input.businessReferredByAgentId === input.agentId) ||
    (!!input.agentReferredByBusinessId && input.agentReferredByBusinessId === input.businessId)
  ) {
    signals.push('referral_link');
  }
  return signals;
}

/** Signals stay visible for audit; a dismissed badge stays off. */
export function relationBadge(input: RelationInput): RelationBadge {
  const signals = relationSignals(input);
  const dismissed = !!input.dismissedAt;
  return { possible_relation: signals.length > 0 && !dismissed, relation_signals: signals, relation_dismissed: dismissed };
}
