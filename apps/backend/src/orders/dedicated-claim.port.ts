import type { OrderAssignmentSource } from '../dedicated-agents/dedicated-agents.constants';

/**
 * #594 PR 5: how a dedicated assignment is stamped on the order, in the same
 * atomic update that assigns it. Absent for every other claim (unchanged).
 */
export interface ClaimAssignment {
  source: Extract<OrderAssignmentSource, 'dedicated_offer' | 'dedicated_auto'>;
  dedicatedAssignmentId: string | null;
  /** dedicated_auto: until when the agent may hand the order back (PR 6). */
  releaseUntil?: string | null;
  /**
   * QA #607 N1: the market's per-agent order cap. When set, the claim runs as
   * `dedicated_claim_order` (agent row lock + count + assign in one transaction).
   */
  maxActiveOrders?: number;
  /** Count the agent's other live dedicated offers too (auto-assign); an accept doesn't (QA #607 N4). */
  countOffers?: boolean;
}

/** What the dedicated dispatch needs from the claim core (OrdersService.claimOrderForAgent). */
export interface DedicatedOrderClaimer {
  claimOrderForAgent(params: {
    orderId: string;
    user: { id: string; first_name?: string | null; last_name?: string | null };
    agent: { id: string; is_verified?: boolean | null; is_internal?: boolean | null };
    fundsCheckSource: 'claim' | 'offer_accept';
    assignment?: ClaimAssignment;
  }): Promise<unknown>;
}

/**
 * DI token for the claimer (OrdersModule aliases it to OrdersService). Resolved
 * lazily through ModuleRef: OrdersService -> OrderOffersService ->
 * DedicatedDispatchService -> OrdersService would otherwise be a cycle.
 */
export const DEDICATED_ORDER_CLAIMER = 'DEDICATED_ORDER_CLAIMER';
