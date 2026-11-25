export type AgentListLifecycleAction = 'pickUp' | 'startTransit' | 'outForDelivery';

export const AGENT_LIST_LIFECYCLE_CONFIRM: Record<
  AgentListLifecycleAction,
  { titleKey: string; titleDef: string; messageKey: string; messageDef: string }
> = {
  pickUp: {
    titleKey: 'agent.orders.detail.actionConfirm.pickUpTitle',
    titleDef: 'Confirm pickup',
    messageKey: 'agent.orders.detail.actionConfirm.pickUpMessage',
    messageDef: 'Mark this order as picked up from the business?',
  },
  startTransit: {
    titleKey: 'agent.orders.detail.actionConfirm.inTransitTitle',
    titleDef: 'Confirm in transit',
    messageKey: 'agent.orders.detail.actionConfirm.inTransitMessage',
    messageDef: 'Mark this order as in transit?',
  },
  outForDelivery: {
    titleKey: 'agent.orders.detail.actionConfirm.outForDeliveryTitle',
    titleDef: 'Confirm out for delivery',
    messageKey: 'agent.orders.detail.actionConfirm.outForDeliveryMessage',
    messageDef: 'Mark this order as out for delivery at the customer address?',
  },
};

/** Pending confirm and in-flight action both occupy the card so a second tap cannot stack. */
export function isAgentListLifecycleBusy(
  orderId: string,
  actionBusyOrderId: string | null,
  pendingLifecycleOrderId: string | null | undefined
): boolean {
  return actionBusyOrderId === orderId || pendingLifecycleOrderId === orderId;
}
