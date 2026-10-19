import { showsDeliveryChrome } from '../agents/agent-focus.util';
import type { DedicatedAssignmentStatus } from './dedicated-agents.constants';

export type DedicatedRail = 'mobile_money' | 'stripe';

/** Why a dedicated agent can't take a given order (AC-E2 / E5). */
export type DedicatedIneligibleReason =
  | 'assignment_not_active'
  | 'off_today'
  | 'not_verified'
  | 'contract_unsigned'
  | 'suspended'
  | 'commercial_focus'
  | 'internal_only'
  | 'at_capacity'
  | 'negative_balance'
  | 'insufficient_balance'
  /** The order hold could not be resolved for this agent (fail closed). */
  | 'hold_unavailable';

export interface DedicatedAgentFacts {
  assignmentStatus: DedicatedAssignmentStatus | string;
  /** `dedicated_agent_assignments.off_today_date` (YYYY-MM-DD) or null. */
  offTodayDate: string | null;
  isVerified: boolean;
  isInternal: boolean;
  agentStatus: string | null;
  focus: string | null;
  /** False only when the contract gate is on and the agent hasn't signed. */
  contractSigned: boolean;
  /** Orders assigned to the agent in an active status, all rails and sources. */
  activeOrders: number;
  /** Dedicated offers to the agent still `offered` and not expired. */
  outstandingDedicatedOffers: number;
}

export interface DedicatedEligibilityContext {
  /** Today in the country timezone (YYYY-MM-DD). */
  localToday: string;
  maxActiveOrders: number;
  rail: DedicatedRail;
  verifiedAgentDelivery: boolean;
}

/** Hold applies only to independents on a non-Stripe order (internal or Stripe: hold 0, no balance check). */
export function requiresBalanceCheck(isInternal: boolean, rail: DedicatedRail): boolean {
  return !isInternal && rail !== 'stripe';
}

/** AC-E2 capacity: active orders (all) + outstanding dedicated offers < max (10). */
export function hasDedicatedCapacity(
  activeOrders: number,
  outstandingDedicatedOffers: number,
  maxActiveOrders: number
): boolean {
  return activeOrders + outstandingDedicatedOffers < maxActiveOrders;
}

/**
 * Every AC-E2 / E5 rule except the balance check (which needs the order's
 * hold). No proximity, `is_available` or GPS freshness: covering the slot
 * regardless of where the agent is right now is the point of dedicated agents.
 */
export function dedicatedProfileIneligibleReason(
  f: DedicatedAgentFacts,
  ctx: DedicatedEligibilityContext
): DedicatedIneligibleReason | null {
  if (f.assignmentStatus !== 'active') return 'assignment_not_active';
  if (f.offTodayDate != null && f.offTodayDate === ctx.localToday) return 'off_today';
  if (!f.isVerified) return 'not_verified';
  if (!f.contractSigned) return 'contract_unsigned';
  if (f.agentStatus === 'suspended') return 'suspended';
  if (!showsDeliveryChrome(f.focus)) return 'commercial_focus';
  if (ctx.verifiedAgentDelivery && !f.isInternal) return 'internal_only';
  if (!hasDedicatedCapacity(f.activeOrders, f.outstandingDedicatedOffers, ctx.maxActiveOrders)) {
    return 'at_capacity';
  }
  return null;
}

/** Independent on a non-Stripe order: available balance >= hold(order); a negative balance covers nothing. */
export function dedicatedBalanceIneligibleReason(
  availableBalance: number,
  holdAmount: number
): DedicatedIneligibleReason | null {
  if (!(availableBalance >= 0)) return 'negative_balance';
  if (availableBalance < holdAmount) return 'insufficient_balance';
  return null;
}

/** Full AC-E2 check once the hold and balance are known (both ignored when no balance check applies). */
export function dedicatedIneligibleReason(
  f: DedicatedAgentFacts,
  ctx: DedicatedEligibilityContext,
  money: { availableBalance: number; holdAmount: number }
): DedicatedIneligibleReason | null {
  const profile = dedicatedProfileIneligibleReason(f, ctx);
  if (profile) return profile;
  if (!requiresBalanceCheck(f.isInternal, ctx.rail)) return null;
  return dedicatedBalanceIneligibleReason(money.availableBalance, money.holdAmount);
}

/**
 * AC-E1: dedicated coverage only for scheduled orders with a
 * `delivery_time_windows` row. Dispatch (PR 5) additionally requires the
 * window to be confirmed (PE); checkout can't, because confirmation happens later.
 */
export function isDedicatedEligibleOrder(order: {
  fulfillmentTiming: string | null | undefined;
  hasDeliveryWindow: boolean;
  windowConfirmed?: boolean | null;
  requireConfirmedWindow?: boolean;
}): boolean {
  if (order.fulfillmentTiming !== 'scheduled') return false;
  if (!order.hasDeliveryWindow) return false;
  if (order.requireConfirmedWindow && order.windowConfirmed !== true) return false;
  return true;
}
