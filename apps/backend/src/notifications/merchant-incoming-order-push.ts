export const MERCHANT_INCOMING_ORDER_PUSH = {
  priority: 'high' as const,
  sound: 'default',
  channelId: 'order_incoming',
};

export function isIncomingOrderInterruptible(
  acceptanceMode?: string | null
): boolean {
  return acceptanceMode !== 'scheduled';
}

export function incomingOrderDelegateEvent(
  acceptanceMode?: string | null
): 'order_created' | 'order_scheduled' {
  return isIncomingOrderInterruptible(acceptanceMode)
    ? 'order_created'
    : 'order_scheduled';
}

export function incomingOrderExpoOptions(acceptanceMode?: string | null) {
  return isIncomingOrderInterruptible(acceptanceMode)
    ? MERCHANT_INCOMING_ORDER_PUSH
    : undefined;
}
