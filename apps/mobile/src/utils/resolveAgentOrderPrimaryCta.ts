export type AgentOrderPrimaryCtaId =
  | 'claim'
  | 'pickUp'
  | 'outForDelivery'
  | 'requestPayment'
  | 'markDelivered';

export type AgentOrderPrimaryCtaInput = {
  status: string;
  assignedAgentId?: string | null;
  agentSuspended?: boolean;
  needsPayAtDeliveryActions?: boolean;
};

/** Single sticky primary action for AgentOrderDetail. Null hides the footer. */
export function resolveAgentOrderPrimaryCta(
  input: AgentOrderPrimaryCtaInput
): AgentOrderPrimaryCtaId | null {
  const status = input.status;
  if (status === 'ready_for_pickup' && !input.assignedAgentId && !input.agentSuspended) {
    return 'claim';
  }
  if (status === 'assigned_to_agent') return 'pickUp';
  // POST /orders/out_for_delivery accepts picked_up and in_transit (start_transit is optional).
  if (status === 'picked_up' || status === 'in_transit') return 'outForDelivery';
  if (status === 'out_for_delivery') {
    return input.needsPayAtDeliveryActions ? 'requestPayment' : 'markDelivered';
  }
  return null;
}
