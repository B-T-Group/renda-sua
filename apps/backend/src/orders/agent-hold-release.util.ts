import type { HasuraSystemService } from '../hasura/hasura-system.service';

/**
 * #622 / atomic agent hold releases: every agent hold release goes through the
 * `release_agent_order_hold` SQL function (migration 20261019230000). Under the agent
 * account row lock (FOR NO KEY UPDATE) it computes the net held for this agent and
 * order, credits min(net, cap), and writes the balance change and the ledger row in
 * one transaction, keyed `agent-hold-release:<order>:<account>:h<n>:r<m>`. So two
 * paths (completion, failed delivery, drop, the stranded-hold reconciler) can never
 * release the same hold twice, and never more than is held for the order.
 */
/** Money alert when an agent hold release fails on a path that does not throw. */
export const AGENT_HOLD_RELEASE_FAILED_MARKER = 'agent_hold_release_failed';

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
