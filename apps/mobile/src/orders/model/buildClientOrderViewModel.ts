import { isStorePickupOrder } from '../../utils/businessOrderListDisplay';
import {
  actionFromPrimary,
  formatEta,
  friendlyStatus,
  mapItems,
  mapTimeline,
  moneySummary,
  phaseFor,
  progressFor,
  toContact,
} from './helpers';
import type {
  ClientOrderViewModel,
  OrderActionDescriptor,
  OrderLike,
  OrderViewModelContext,
} from './types';

function clientHero(order: OrderLike, ctx: OrderViewModelContext): string {
  const s = order.current_status;
  const pickup = isStorePickupOrder(order);
  if (s === 'out_for_delivery') {
    return ctx.t('orders.client.hero.onTheWay', 'Your order is on its way');
  }
  if (s === 'preparing' || s === 'confirmed') {
    return pickup
      ? ctx.t(
          'orders.client.hero.preparingPickup',
          'The store is preparing your order for pickup'
        )
      : ctx.t(
          'orders.client.hero.preparing',
          'The business is preparing your order'
        );
  }
  if (s === 'ready_for_pickup') {
    return pickup
      ? ctx.t('orders.client.hero.readyPickup', 'Ready for pickup')
      : ctx.t(
          'orders.client.hero.waitingAgent',
          'Waiting for a delivery agent'
        );
  }
  if (s === 'delivered') {
    return ctx.t('orders.client.hero.delivered', 'Delivered — please confirm');
  }
  if (s === 'complete') {
    return ctx.t('orders.client.hero.complete', 'Order complete');
  }
  return friendlyStatus(order, 'client', ctx);
}

function clientActions(
  order: OrderLike,
  primaryId: ClientOrderViewModel['primaryActionId']
): OrderActionDescriptor[] {
  const actions: OrderActionDescriptor[] = [];
  const primary = actionFromPrimary(primaryId);
  if (primary) actions.push(primary);

  const s = order.current_status;
  if (['pending', 'pending_payment', 'confirmed', 'preparing'].includes(s)) {
    actions.push({
      id: 'cancel',
      labelKey: 'orders.actions.cancel',
      labelDefault: 'Cancel order',
      variant: 'danger',
    });
  }
  if (
    ['assigned_to_agent', 'picked_up', 'in_transit', 'out_for_delivery'].includes(
      s
    )
  ) {
    actions.push({
      id: 'track',
      labelKey: 'orders.client.actions.track',
      labelDefault: 'Track delivery',
      variant: 'outlined',
    });
  }
  if (['delivered', 'failed', 'complete', 'refunded'].includes(s)) {
    actions.push({
      id: 'report_issue',
      labelKey: 'orders.client.actions.reportIssue',
      labelDefault: 'Report issue',
      variant: 'text',
    });
  }
  actions.push({
    id: 'contact_business',
    labelKey: 'orders.client.actions.contactBusiness',
    labelDefault: 'Contact business',
    variant: 'text',
  });
  if (order.assigned_agent_id) {
    actions.push({
      id: 'contact_agent',
      labelKey: 'orders.client.actions.contactAgent',
      labelDefault: 'Contact delivery agent',
      variant: 'text',
    });
  }
  return actions;
}

export function buildClientOrderViewModel(
  order: OrderLike,
  ctx: OrderViewModelContext
): ClientOrderViewModel {
  const phase = phaseFor(order, 'client');
  const nextStepMessage = phase.nextStepKey
    ? ctx.t(phase.nextStepKey, '')
    : null;

  return {
    orderId: order.id,
    orderNumber: order.order_number,
    status: order.current_status,
    statusMessage: friendlyStatus(order, 'client', ctx),
    heroTitle: clientHero(order, ctx),
    nextStepMessage: nextStepMessage || null,
    etaText: formatEta(order, ctx),
    progress: progressFor(order),
    phase: phase.phase,
    primaryActionId: phase.primaryActionId,
    businessName: order.business?.name ?? null,
    summary: moneySummary(order),
    contacts: {
      business: toContact(order.business?.user, order.business?.name),
      agent: toContact(order.assigned_agent?.user),
    },
    timeline: mapTimeline(order),
    items: mapItems(order, true),
    availableActions: clientActions(order, phase.primaryActionId),
  };
}
