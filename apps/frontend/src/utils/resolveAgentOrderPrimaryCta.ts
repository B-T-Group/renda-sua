export type AgentOrderPrimaryCtaId =
  | 'claim'
  | 'pickUp'
  | 'outForDelivery'
  | 'requestPayment'
  | 'markDelivered'
  | 'clientCouldNotConfirm';

export type AgentOrderPrimaryCtaInput = {
  status: string;
  assignedAgentId?: string | null;
  agentSuspended?: boolean;
  needsPayAtDeliveryActions?: boolean;
  canSubmitFallback?: boolean;
};

/** Single primary action. Null hides the footer / action row. */
export function resolveAgentOrderPrimaryCta(
  input: AgentOrderPrimaryCtaInput
): AgentOrderPrimaryCtaId | null {
  const status = input.status;
  if (status === 'ready_for_pickup' && !input.assignedAgentId && !input.agentSuspended) {
    return 'claim';
  }
  if (status === 'assigned_to_agent') return 'pickUp';
  if (status === 'picked_up' || status === 'in_transit') return 'outForDelivery';
  if (status === 'out_for_delivery') {
    return input.needsPayAtDeliveryActions ? 'requestPayment' : 'markDelivered';
  }
  if (status === 'awaiting_client_confirmation' && input.canSubmitFallback) {
    return 'clientCouldNotConfirm';
  }
  return null;
}
