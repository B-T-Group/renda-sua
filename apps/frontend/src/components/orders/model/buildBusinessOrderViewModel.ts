import {
  actionFromPrimary,
  deliveryWindowLabel,
  friendlyStatus,
  isOverdue,
  mapItems,
  moneySummary,
  phaseFor,
  toContact,
} from './helpers';
import type {
  BusinessOrderViewModel,
  OrderActionDescriptor,
  OrderLike,
  OrderViewModelContext,
} from './types';

function requiredActionLabel(
  order: OrderLike,
  primaryId: BusinessOrderViewModel['primaryActionId'],
  ctx: OrderViewModelContext
): string {
  const map: Record<string, [string, string]> = {
    confirm: ['orders.business.hero.accept', 'Accept Order'],
    mark_ready: ['orders.business.hero.prepare', 'Prepare Order'],
    confirm_pickup: ['orders.business.hero.confirmPickup', 'Confirm Pickup'],
    collect_pickup_payment: [
      'orders.business.hero.collectPayment',
      'Collect Pickup Payment',
    ],
    complete: ['orders.business.hero.complete', 'Complete Order'],
    generate_overwrite: [
      'orders.business.hero.overwrite',
      'Generate Overwrite Code',
    ],
    reconcile_cash: ['orders.business.hero.reconcile', 'Reconcile Cash'],
    open_refunds: ['orders.business.hero.refund', 'Manage Refund'],
  };
  const entry = map[primaryId];
  if (entry) return ctx.t(entry[0], entry[1]);
  if (order.current_status === 'ready_for_pickup') {
    return ctx.t('orders.business.hero.waitingAgent', 'Waiting for Agent');
  }
  if (['delivered', 'complete'].includes(order.current_status)) {
    return ctx.t('orders.business.hero.completed', 'Order Completed');
  }
  return friendlyStatus(order, 'business', ctx);
}

function slaFor(
  order: OrderLike,
  ctx: OrderViewModelContext
): BusinessOrderViewModel['slaCountdown'] {
  if (order.current_status === 'pending' && order.acceptance_deadline_at) {
    return {
      deadlineAt: order.acceptance_deadline_at,
      label: ctx.t('orders.business.sla.acceptWithin', 'Accept within'),
      overdue: isOverdue(order.acceptance_deadline_at, ctx.now),
    };
  }
  if (
    ['confirmed', 'preparing'].includes(order.current_status) &&
    order.estimated_delivery_time
  ) {
    return {
      deadlineAt: order.estimated_delivery_time,
      label: ctx.t('orders.business.sla.prepBy', 'Preparation expected by'),
      overdue: isOverdue(order.estimated_delivery_time, ctx.now),
    };
  }
  return null;
}

function businessActions(
  order: OrderLike,
  primaryId: BusinessOrderViewModel['primaryActionId']
): OrderActionDescriptor[] {
  const actions: OrderActionDescriptor[] = [];
  const primary = actionFromPrimary(primaryId);
  if (primary) actions.push(primary);

  if (order.current_status === 'pending') {
    actions.push({
      id: 'reject',
      labelKey: 'orders.business.actions.reject',
      labelDefault: 'Reject',
      variant: 'danger',
    });
  }
  if (['pending', 'confirmed', 'preparing'].includes(order.current_status)) {
    actions.push({
      id: 'cancel',
      labelKey: 'orders.actions.cancel',
      labelDefault: 'Cancel order',
      variant: 'danger',
    });
  }
  actions.push({
    id: 'contact_customer',
    labelKey: 'orders.business.actions.contactCustomer',
    labelDefault: 'Contact customer',
    variant: 'text',
  });
  if (order.assigned_agent_id) {
    actions.push({
      id: 'contact_agent',
      labelKey: 'orders.business.actions.contactAgent',
      labelDefault: 'Contact agent',
      variant: 'text',
    });
  }
  return actions;
}

export function buildBusinessOrderViewModel(
  order: OrderLike,
  ctx: OrderViewModelContext
): BusinessOrderViewModel {
  const phase = phaseFor(order, 'business');
  const requiredAction = requiredActionLabel(order, phase.primaryActionId, ctx);
  const nextStepMessage = phase.nextStepKey
    ? ctx.t(phase.nextStepKey, '')
    : null;

  return {
    orderId: order.id,
    orderNumber: order.order_number,
    status: order.current_status,
    statusMessage: friendlyStatus(order, 'business', ctx),
    requiredAction,
    heroTitle: requiredAction,
    nextStepMessage: nextStepMessage || null,
    slaCountdown: slaFor(order, ctx),
    phase: phase.phase,
    primaryActionId: phase.primaryActionId,
    customer: toContact(order.client?.user),
    items: mapItems(order, true),
    notes: order.special_instructions ?? null,
    paymentStatus: order.payment_status ?? null,
    paymentStatusLabel: order.payment_status
      ? ctx.t(
          `common.paymentStatus.${order.payment_status}`,
          order.payment_status
        )
      : null,
    deliveryWindowLabel: deliveryWindowLabel(order, ctx),
    assignedAgent: toContact(order.assigned_agent?.user),
    summary: moneySummary(order),
    availableActions: businessActions(order, phase.primaryActionId),
  };
}
