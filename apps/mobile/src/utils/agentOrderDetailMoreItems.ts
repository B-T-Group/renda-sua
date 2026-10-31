export type AgentOrderMoreItemId =
  | 'runningLate'
  | 'release'
  | 'reportIssue'
  | 'failDelivery'
  | 'markPaidCash';

export type AgentOrderMoreInput = {
  status: string;
  assignedAgentId?: string | null;
  pickupExtensionMinutes?: number | null;
  needsPayAtDeliveryActions?: boolean;
  cashExceptionBlocked?: boolean;
};

const REPORT_STATUSES = new Set([
  'assigned_to_agent',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'awaiting_client_confirmation',
  'pending_auto_complete',
  'disputed',
  'delivered',
  'complete',
  'failed',
]);

/** Menu items that apply now. Hidden (not disabled) when they do not apply. */
export function agentOrderDetailMoreItems(input: AgentOrderMoreInput): AgentOrderMoreItemId[] {
  const items: AgentOrderMoreItemId[] = [];
  const status = input.status;
  const assigned = Boolean(input.assignedAgentId);

  if (status === 'assigned_to_agent' && !(input.pickupExtensionMinutes && input.pickupExtensionMinutes > 0)) {
    items.push('runningLate');
  }
  if (status === 'assigned_to_agent') {
    items.push('release');
  }
  if (assigned || REPORT_STATUSES.has(status)) {
    items.push('reportIssue');
  }
  if (status === 'out_for_delivery') {
    items.push('failDelivery');
  }
  if (
    status === 'out_for_delivery' &&
    input.needsPayAtDeliveryActions &&
    !input.cashExceptionBlocked
  ) {
    items.push('markPaidCash');
  }
  return items;
}
