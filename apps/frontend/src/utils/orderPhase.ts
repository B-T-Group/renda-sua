/**
 * Maps product-order status × persona × fulfillment → phase, next step, primary CTA.
 * Keep in sync with mobile-rendasua/src/utils/orderPhase.ts
 */

export type OrderPhase =
  | 'pay'
  | 'confirm'
  | 'prepare'
  | 'ready'
  | 'in_delivery'
  | 'done';

export type OrderPhaseRole = 'client' | 'business' | 'agent';

export type OrderHubGroup = 'action_needed' | 'waiting' | 'past';

export type OrderHubFilter = OrderHubGroup | 'all';

export type BusinessOrderQueue =
  | 'confirm'
  | 'prep'
  | 'pickup'
  | 'issues'
  | 'all';

export type OrderPrimaryActionId =
  | 'pay'
  | 'cancel'
  | 'confirm'
  | 'mark_ready'
  | 'claim'
  | 'pick_up'
  | 'out_for_delivery'
  | 'complete_delivery'
  | 'confirm_pickup'
  | 'collect_pickup_payment'
  | 'send_pin'
  | 'complete'
  | 'rate'
  | 'open_refunds'
  | 'generate_overwrite'
  | 'reconcile_cash'
  | 'none';

export interface OrderPhaseInput {
  status?: string | null;
  fulfillmentMethod?: string | null;
  paymentTiming?: string | null;
  paymentStatus?: string | null;
  paymentMethod?: string | null;
  assignedAgentId?: string | null;
  reconciliationStatus?: string | null;
}

export interface OrderPhaseInfo {
  phase: OrderPhase;
  labelKey: string;
  nextStepKey: string | null;
  hubGroup: OrderHubGroup;
  businessQueue: BusinessOrderQueue | null;
  primaryActionId: OrderPrimaryActionId;
}

const PHASE_LABEL: Record<OrderPhase, string> = {
  pay: 'orders.phases.pay',
  confirm: 'orders.phases.confirm',
  prepare: 'orders.phases.prepare',
  ready: 'orders.phases.ready',
  in_delivery: 'orders.phases.inDelivery',
  done: 'orders.phases.done',
};

const REFUND_STATUSES = new Set([
  'refunded',
  'refund_requested',
  'refund_approved_full',
  'refund_approved_partial',
  'refund_approved_replace',
  'refund_processing',
  'refund_rejected',
  'refund_failed',
]);

const DONE_STATUSES = new Set([
  'complete',
  'cancelled',
  'failed',
  'delivered',
  ...REFUND_STATUSES,
]);

function isPickup(input: OrderPhaseInput): boolean {
  return input.fulfillmentMethod === 'pickup';
}

function isPinEligible(input: OrderPhaseInput): boolean {
  if (input.paymentTiming === 'pay_at_delivery') return false;
  if (input.paymentMethod === 'pay_on_delivery') return false;
  return true;
}

function resolvePhase(input: OrderPhaseInput): OrderPhase {
  const s = input.status ?? '';
  if (DONE_STATUSES.has(s) || REFUND_STATUSES.has(s)) return 'done';
  if (s === 'pending_payment') return 'pay';
  if (s === 'pending') return 'confirm';
  if (s === 'confirmed' || s === 'preparing') return 'prepare';
  if (s === 'ready_for_pickup') return 'ready';
  if (
    s === 'assigned_to_agent' ||
    s === 'picked_up' ||
    s === 'in_transit' ||
    s === 'out_for_delivery'
  ) {
    return 'in_delivery';
  }
  return 'confirm';
}

function capitalize(role: OrderPhaseRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function nextStepKeyFor(
  phase: OrderPhase,
  role: OrderPhaseRole,
  input: OrderPhaseInput
): string | null {
  const s = input.status ?? '';
  const pickup = isPickup(input);

  if (phase === 'done') {
    if (s === 'complete') return `orders.nextStep.complete${capitalize(role)}`;
    if (s === 'delivered') return `orders.nextStep.delivered${capitalize(role)}`;
    if (s === 'refund_requested') return 'orders.nextStep.refundRequested';
    return null;
  }

  if (phase === 'pay') {
    return role === 'client'
      ? 'orders.nextStep.payClient'
      : 'orders.nextStep.payBusiness';
  }
  if (phase === 'confirm') {
    return role === 'client'
      ? 'orders.nextStep.confirmClient'
      : role === 'business'
        ? 'orders.nextStep.confirmBusiness'
        : null;
  }
  if (phase === 'prepare') {
    return role === 'client'
      ? 'orders.nextStep.prepareClient'
      : role === 'business'
        ? 'orders.nextStep.prepareBusiness'
        : null;
  }
  if (phase === 'ready') {
    if (pickup) {
      return role === 'client'
        ? 'orders.nextStep.readyPickupClient'
        : role === 'business'
          ? 'orders.nextStep.readyPickupBusiness'
          : null;
    }
    return role === 'client'
      ? 'orders.nextStep.readyDeliveryClient'
      : role === 'business'
        ? 'orders.nextStep.readyDeliveryBusiness'
        : role === 'agent'
          ? 'orders.nextStep.readyAgent'
          : null;
  }
  if (phase === 'in_delivery') {
    if (s === 'out_for_delivery') {
      return role === 'client'
        ? isPinEligible(input)
          ? 'orders.nextStep.ofdClientPin'
          : 'orders.nextStep.ofdClient'
        : role === 'agent'
          ? 'orders.nextStep.ofdAgent'
          : 'orders.nextStep.ofdBusiness';
    }
    return role === 'client'
      ? 'orders.nextStep.inDeliveryClient'
      : role === 'agent'
        ? 'orders.nextStep.inDeliveryAgent'
        : 'orders.nextStep.inDeliveryBusiness';
  }
  return null;
}

function hubGroupFor(
  phase: OrderPhase,
  role: OrderPhaseRole,
  input: OrderPhaseInput
): OrderHubGroup {
  if (phase === 'done') {
    const s = input.status ?? '';
    if (role === 'client' && (s === 'delivered' || s === 'complete')) {
      return 'action_needed';
    }
    if (
      role === 'business' &&
      (s === 'delivered' || s === 'refund_requested')
    ) {
      return 'action_needed';
    }
    return 'past';
  }

  if (role === 'client') {
    if (phase === 'pay') return 'action_needed';
    if (
      phase === 'in_delivery' &&
      input.status === 'out_for_delivery' &&
      isPinEligible(input)
    ) {
      return 'action_needed';
    }
    return 'waiting';
  }

  if (role === 'business') {
    if (
      phase === 'confirm' ||
      phase === 'prepare' ||
      (phase === 'ready' && isPickup(input)) ||
      input.reconciliationStatus === 'pending_manual_reconciliation' ||
      input.status === 'refund_requested'
    ) {
      return 'action_needed';
    }
    return 'waiting';
  }

  if (phase === 'ready' || phase === 'in_delivery') return 'action_needed';
  return 'waiting';
}

function businessQueueFor(
  phase: OrderPhase,
  input: OrderPhaseInput
): BusinessOrderQueue | null {
  if (input.reconciliationStatus === 'pending_manual_reconciliation') {
    return 'issues';
  }
  const s = input.status ?? '';
  if (s === 'refund_requested' || s === 'failed') return 'issues';
  if (phase === 'confirm') return 'confirm';
  if (phase === 'prepare') return 'prep';
  if (phase === 'ready' && isPickup(input)) return 'pickup';
  if (s === 'out_for_delivery') return 'issues';
  return null;
}

function primaryActionFor(
  phase: OrderPhase,
  role: OrderPhaseRole,
  input: OrderPhaseInput
): OrderPrimaryActionId {
  const s = input.status ?? '';
  const pickup = isPickup(input);

  if (
    input.reconciliationStatus === 'pending_manual_reconciliation' &&
    role === 'business'
  ) {
    return 'reconcile_cash';
  }

  if (role === 'client') {
    if (phase === 'pay') return 'pay';
    if (s === 'out_for_delivery' && isPinEligible(input)) return 'send_pin';
    if (s === 'delivered') return 'complete';
    if (s === 'complete') return 'rate';
    return 'none';
  }

  if (role === 'business') {
    if (s === 'refund_requested') return 'open_refunds';
    if (phase === 'confirm') return 'confirm';
    if (phase === 'prepare') return 'mark_ready';
    if (phase === 'ready' && pickup) {
      if (
        input.paymentTiming === 'pay_at_pickup' &&
        input.paymentStatus === 'pending'
      ) {
        return 'collect_pickup_payment';
      }
      if (
        input.paymentTiming !== 'pay_at_pickup' &&
        (input.paymentStatus === 'authorized' || input.paymentStatus === 'paid')
      ) {
        return 'confirm_pickup';
      }
    }
    if (s === 'out_for_delivery') return 'generate_overwrite';
    if (s === 'delivered') return 'complete';
    return 'none';
  }

  if (s === 'ready_for_pickup' && !pickup) return 'claim';
  if (s === 'assigned_to_agent') return 'pick_up';
  if (s === 'picked_up' || s === 'in_transit') return 'out_for_delivery';
  if (s === 'out_for_delivery') return 'complete_delivery';
  return 'none';
}

export function resolveOrderPhase(
  input: OrderPhaseInput,
  role: OrderPhaseRole
): OrderPhaseInfo {
  const phase = resolvePhase(input);
  return {
    phase,
    labelKey: PHASE_LABEL[phase],
    nextStepKey: nextStepKeyFor(phase, role, input),
    hubGroup: hubGroupFor(phase, role, input),
    businessQueue: businessQueueFor(phase, input),
    primaryActionId: primaryActionFor(phase, role, input),
  };
}

export const BUSINESS_ORDER_QUEUE_FILTERS: BusinessOrderQueue[] = [
  'confirm',
  'prep',
  'pickup',
  'issues',
  'all',
];

export function matchesBusinessOrderQueue(
  info: OrderPhaseInfo,
  filter: BusinessOrderQueue
): boolean {
  if (filter === 'all') return true;
  return info.businessQueue === filter;
}

export function matchesOrderHub(
  info: OrderPhaseInfo,
  filter: OrderHubFilter
): boolean {
  if (filter === 'all') return true;
  return info.hubGroup === filter;
}

export function orderProgressSteps(fulfillmentMethod?: string | null): string[] {
  if (fulfillmentMethod === 'pickup') {
    return ['pending', 'confirmed', 'ready_for_pickup', 'complete'];
  }
  return [
    'pending',
    'confirmed',
    'ready_for_pickup',
    'assigned_to_agent',
    'out_for_delivery',
    'complete',
  ];
}

export function messagesDefaultExpandedForOrder(status: string): boolean {
  return (
    status === 'out_for_delivery' ||
    status === 'picked_up' ||
    status === 'in_transit' ||
    status === 'assigned_to_agent'
  );
}

export const ORDER_PRIMARY_ACTION_LABEL: Record<
  OrderPrimaryActionId,
  [string, string]
> = {
  pay: ['orders.actions.completePayment', 'Complete payment'],
  cancel: ['orders.actions.cancel', 'Cancel order'],
  confirm: ['orders.actions.confirm', 'Confirm order'],
  mark_ready: ['orders.actions.markReady', 'Mark ready'],
  claim: ['orders.actions.claim', 'Claim order'],
  pick_up: ['orders.actions.pickUp', 'Pick up'],
  out_for_delivery: ['orders.actions.outForDelivery', 'Out for delivery'],
  complete_delivery: ['orders.actions.completeDelivery', 'Complete delivery'],
  confirm_pickup: ['orders.actions.confirmPickup', 'Confirm pickup'],
  collect_pickup_payment: [
    'orders.actions.collectPickupPayment',
    'Collect pickup payment',
  ],
  send_pin: ['orders.actions.sendPin', 'Send delivery PIN'],
  complete: ['orders.actions.complete', 'Complete order'],
  rate: ['orders.actions.rate', 'Rate order'],
  open_refunds: ['orders.actions.openRefunds', 'Manage refund'],
  generate_overwrite: [
    'orders.actions.generateOverwrite',
    'Generate overwrite code',
  ],
  reconcile_cash: ['orders.actions.reconcileCash', 'Reconcile cash'],
  none: ['orders.actions.none', ''],
};

/** Build OrderPhaseInput from a typical order-shaped object. */
export function orderToPhaseInput(order: {
  current_status?: string | null;
  fulfillment_method?: string | null;
  payment_timing?: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  assigned_agent_id?: string | null;
  reconciliation_status?: string | null;
}): OrderPhaseInput {
  return {
    status: order.current_status,
    fulfillmentMethod: order.fulfillment_method,
    paymentTiming: order.payment_timing,
    paymentStatus: order.payment_status,
    paymentMethod: order.payment_method,
    assignedAgentId: order.assigned_agent_id,
    reconciliationStatus: order.reconciliation_status,
  };
}
