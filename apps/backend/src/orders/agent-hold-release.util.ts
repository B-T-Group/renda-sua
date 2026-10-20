import type { HasuraSystemService } from '../hasura/hasura-system.service';

/** Money alert when an agent hold release fails on a path that does not throw. */
export const AGENT_HOLD_RELEASE_FAILED_MARKER = 'agent_hold_release_failed';

/** Agent fault: less than agent_hold_amount was taken from the agent (expected vs actual). */
export const AGENT_FAULT_COMPENSATION_SHORT_MARKER = 'agent_fault_compensation_short';

/**
 * #622 / atomic agent hold releases: every agent hold release goes through the
 * `release_agent_order_hold` SQL function (migration 20261019230000). Under the agent
 * account row lock (FOR NO KEY UPDATE) it computes the net held for this agent and
 * order, credits min(net, cap), and writes the balance change and the ledger row in
 * one transaction, keyed `agent-hold-release:<order>:<account>:h<n>:r<m>`. So two
 * paths (completion, failed delivery, drop, the stranded-hold reconciler) can never
 * release the same hold twice, and never more than is held for the order.
 *
 * ROLLBACK (#622 L1): this mutation, the Hasura metadata that tracks the function
 * (metadata/databases/Rendasua/functions/public_release_agent_order_hold.yaml + the
 * functions.yaml entry) and the migration go together. Revert the backend first, then
 * the metadata, then run the migration's down.sql. Reverting only one of them leaves
 * the backend calling an untracked or missing function, and every agent hold release
 * fails (completion, drop, failed delivery, reassignment, reconciler).
 */
export const RELEASE_AGENT_ORDER_HOLD_MUTATION = `
  mutation ReleaseAgentOrderHold($accountId: uuid!, $orderId: uuid!, $cap: numeric, $memo: String!) {
    release_agent_order_hold(
      args: { p_account_id: $accountId, p_order_id: $orderId, p_cap: $cap, p_memo: $memo }
    ) {
      id
      amount
    }
  }
`;

export interface AgentHoldReleaseResult {
  success: boolean;
  /** What this call credited (0 when nothing was still held, or a racing path won). */
  released: number;
  error?: string;
}

/** Release up to `cap` of what `accountId` still holds for `orderId`. Never throws. */
export async function releaseAgentOrderHold(
  hasura: Pick<HasuraSystemService, 'executeMutation'>,
  params: { accountId: string; orderId: string; cap?: number | null; memo: string }
): Promise<AgentHoldReleaseResult> {
  try {
    const res = await hasura.executeMutation<{
      release_agent_order_hold: Array<{ id: string; amount: number | string }>;
    }>(RELEASE_AGENT_ORDER_HOLD_MUTATION, {
      accountId: params.accountId,
      orderId: params.orderId,
      cap: params.cap ?? null,
      memo: params.memo,
    });
    return {
      success: true,
      released: Number(res?.release_agent_order_hold?.[0]?.amount ?? 0),
    };
  } catch (error: unknown) {
    return {
      success: false,
      released: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * QA F2: agent fault. `forfeit_agent_order_hold` (migration 20261020010000) moves
 * min(net held, cap) for this agent and order straight from the agent's withheld
 * balance to the business (a `forfeit` row on the agent, a `deposit` row on the
 * business), in one transaction under the agent -> business account row locks, keyed
 * once per order (failed-delivery:agent-fault:agent-forfeit:<order> and
 * :business-deposit:<order>). A retry returns the existing forfeit row. The money never
 * passes through the agent's available balance.
 *
 * ROLLBACK: backend first, then functions/public_forfeit_agent_order_hold.yaml and its
 * functions.yaml entry, then the migration's down.sql (see its header).
 */
export const FORFEIT_AGENT_ORDER_HOLD_MUTATION = `
  mutation ForfeitAgentOrderHold(
    $agentAccountId: uuid!
    $businessAccountId: uuid!
    $orderId: uuid!
    $cap: numeric
    $forfeitMemo: String!
    $businessMemo: String!
  ) {
    forfeit_agent_order_hold(
      args: {
        p_agent_account_id: $agentAccountId
        p_business_account_id: $businessAccountId
        p_order_id: $orderId
        p_cap: $cap
        p_forfeit_memo: $forfeitMemo
        p_business_memo: $businessMemo
      }
    ) {
      id
      amount
    }
  }
`;

export interface AgentHoldForfeitResult {
  success: boolean;
  /** What was moved agent -> business for this order (this call or an earlier one). */
  forfeited: number;
  error?: string;
}

/** Forfeit up to `cap` of the agent's hold on `orderId` to the business. Never throws. */
export async function forfeitAgentOrderHold(
  hasura: Pick<HasuraSystemService, 'executeMutation'>,
  params: {
    agentAccountId: string;
    businessAccountId: string;
    orderId: string;
    cap?: number | null;
    forfeitMemo: string;
    businessMemo: string;
  }
): Promise<AgentHoldForfeitResult> {
  try {
    const res = await hasura.executeMutation<{
      forfeit_agent_order_hold: Array<{ id: string; amount: number | string }>;
    }>(FORFEIT_AGENT_ORDER_HOLD_MUTATION, { ...params, cap: params.cap ?? null });
    return {
      success: true,
      forfeited: Number(res?.forfeit_agent_order_hold?.[0]?.amount ?? 0),
    };
  } catch (error: unknown) {
    return {
      success: false,
      forfeited: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
