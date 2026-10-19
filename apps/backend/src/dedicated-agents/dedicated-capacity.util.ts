import { requiresBalanceCheck, type DedicatedRail } from './dedicated-eligibility.util';

/**
 * How many more orders an agent can take (AC-A5 "{{active}}/10", AC-A5b
 * "Balance covers ~n more"): min(max - active - outstanding, floor(balance /
 * typicalHold)) for an independent on a non-Stripe rail, the slot capacity
 * otherwise. A negative balance covers 0; an unknown/zero typical hold
 * leaves only the order-count limit.
 */
export function computeEffectiveCapacity(params: {
  maxActiveOrders: number;
  activeOrders: number;
  outstandingDedicatedOffers?: number;
  isInternal: boolean;
  rail: DedicatedRail;
  availableBalance?: number | null;
  typicalHold?: number | null;
}): number {
  const slots = Math.max(
    0,
    Math.floor(params.maxActiveOrders - params.activeOrders - (params.outstandingDedicatedOffers ?? 0))
  );
  if (!requiresBalanceCheck(params.isInternal, params.rail)) return slots;
  const balance = Number(params.availableBalance ?? 0);
  if (!(balance >= 0)) return 0;
  const hold = Number(params.typicalHold ?? 0);
  if (!(hold > 0)) return slots;
  return Math.min(slots, Math.floor(balance / hold));
}
