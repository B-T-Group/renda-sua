import {
  agentOrderDetailMoreItems,
  type AgentOrderMoreInput,
  type AgentOrderMoreItemId,
} from './agentOrderDetailMoreItems';
import {
  resolveAgentOrderPrimaryCta,
  type AgentOrderPrimaryCtaId,
  type AgentOrderPrimaryCtaInput,
} from './resolveAgentOrderPrimaryCta';
import {
  rankOrderDetailActions,
  type RankedOrderAction,
  type RankedOrderActions,
} from './rankOrderDetailActions';

const PRIMARY_LABEL: Record<
  AgentOrderPrimaryCtaId,
  { labelKey: string; defaultLabel: string }
> = {
  claim: {
    labelKey: 'agent.openOrders.claimButton',
    defaultLabel: 'Claim order',
  },
  pickUp: {
    labelKey: 'agent.orders.detail.confirmPickup',
    defaultLabel: 'Confirm pickup',
  },
  outForDelivery: {
    labelKey: 'agent.orders.detail.markOutForDelivery',
    defaultLabel: 'Out for delivery',
  },
  requestPayment: {
    labelKey: 'agent.orders.detail.requestPayment',
    defaultLabel: 'Request payment',
  },
  markDelivered: {
    labelKey: 'agent.orders.detail.markDelivered',
    defaultLabel: 'Mark delivered',
  },
  clientCouldNotConfirm: {
    labelKey: 'agent.orders.detail.clientCouldNotConfirm',
    defaultLabel: "Client couldn't confirm",
  },
};

const MORE_LABEL: Record<
  AgentOrderMoreItemId,
  { labelKey: string; defaultLabel: string; destructive?: boolean }
> = {
  runningLate: {
    labelKey: 'agentOrder.more.runningLate',
    defaultLabel: "I'm running late",
  },
  release: {
    labelKey: 'agentOrder.more.release',
    defaultLabel: 'Release order',
    destructive: true,
  },
  reportIssue: {
    labelKey: 'agentOrder.more.reportIssue',
    defaultLabel: 'Report a problem',
  },
  failDelivery: {
    labelKey: 'agentOrder.more.failDelivery',
    defaultLabel: 'Mark as failed',
    destructive: true,
  },
  markPaidCash: {
    labelKey: 'agentOrder.more.markPaidCash',
    defaultLabel: 'Mark paid in cash',
  },
};

export type RankAgentOrderDetailInput = AgentOrderPrimaryCtaInput &
  AgentOrderMoreInput;

/** Sticky-bar ranking for agent order detail (primary + More overflow). */
export function rankAgentOrderDetailActions(
  input: RankAgentOrderDetailInput
): RankedOrderActions {
  const primaryId = resolveAgentOrderPrimaryCta(input);
  const moreIds = agentOrderDetailMoreItems(input);
  const actions: RankedOrderAction[] = [];

  if (primaryId) {
    const label = PRIMARY_LABEL[primaryId];
    actions.push({
      id: primaryId,
      labelKey: label.labelKey,
      defaultLabel: label.defaultLabel,
      preferred: true,
    });
  }

  for (const id of moreIds) {
    const label = MORE_LABEL[id];
    actions.push({
      id,
      labelKey: label.labelKey,
      defaultLabel: label.defaultLabel,
      destructive: label.destructive,
    });
  }

  if (!primaryId) {
    return { primary: null, companion: null, overflow: actions };
  }
  return rankOrderDetailActions(actions, primaryId);
}
