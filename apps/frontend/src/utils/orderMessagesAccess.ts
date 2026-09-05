export function canSeeOrderMessages(params: {
  persona: string | null | undefined;
  agentId: string | null | undefined;
  assignedAgentId: string | null | undefined;
}): boolean {
  if (params.persona !== 'agent') return true;
  return Boolean(params.agentId) && params.assignedAgentId === params.agentId;
}

export function resolveDelegateMessagesRedirect(params: {
  isDelegationContext: boolean;
  ordersApiPrefix: string | null | undefined;
  orderId: string | null | undefined;
  search?: string;
}): string | null {
  if (
    !params.isDelegationContext ||
    params.ordersApiPrefix === '/delegate' ||
    !params.orderId
  ) {
    return null;
  }
  return `/delegate/orders/${params.orderId}/messages${params.search ?? ''}`;
}
