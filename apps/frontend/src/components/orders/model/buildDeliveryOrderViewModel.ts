import {
  actionFromPrimary,
  deliveryWindowLabel,
  friendlyStatus,
  isOverdue,
  mapItems,
  phaseFor,
  toContact,
} from './helpers';
import type {
  DeliveryOrderViewModel,
  DeliveryRequirement,
  OrderActionDescriptor,
  OrderLike,
  OrderViewModelContext,
  PackageProperty,
} from './types';

function objective(
  order: OrderLike,
  ctx: OrderViewModelContext
): string {
  const s = order.current_status;
  if (s === 'ready_for_pickup') {
    return ctx.t('orders.delivery.hero.claim', 'Claim this delivery');
  }
  if (s === 'assigned_to_agent') {
    return ctx.t('orders.delivery.hero.goPickup', 'Go to pickup');
  }
  if (s === 'picked_up') {
    return ctx.t('orders.delivery.hero.pickupDone', 'Package picked up');
  }
  if (s === 'in_transit') {
    return ctx.t('orders.delivery.hero.deliver', 'Deliver to customer');
  }
  if (s === 'out_for_delivery') {
    return ctx.t('orders.delivery.hero.complete', 'Complete delivery');
  }
  return friendlyStatus(order, 'agent', ctx);
}

function urgencyFor(
  order: OrderLike,
  ctx: OrderViewModelContext
): DeliveryOrderViewModel['urgency'] {
  if (order.current_status === 'assigned_to_agent' && order.estimated_delivery_time) {
    return {
      deadlineAt: order.estimated_delivery_time,
      label: ctx.t('orders.delivery.urgency.pickupWithin', 'Pickup within'),
      overdue: isOverdue(order.estimated_delivery_time, ctx.now),
    };
  }
  if (
    ['picked_up', 'in_transit', 'out_for_delivery'].includes(order.current_status) &&
    order.estimated_delivery_time
  ) {
    return {
      deadlineAt: order.estimated_delivery_time,
      label: ctx.t('orders.delivery.urgency.deliverBy', 'Deliver by'),
      overdue: isOverdue(order.estimated_delivery_time, ctx.now),
    };
  }
  return null;
}

function packageProperties(
  order: OrderLike,
  ctx: OrderViewModelContext
): PackageProperty[] {
  const props: PackageProperty[] = [];
  if (order.requires_fast_delivery) {
    props.push({
      id: 'fast',
      label: ctx.t('orders.delivery.properties.fast', 'Fast Delivery'),
    });
  }
  const items = order.order_items ?? [];
  const heavy = items.some((i) => (i.item?.weight ?? 0) >= 10);
  if (heavy) {
    props.push({
      id: 'heavy',
      label: ctx.t('orders.delivery.properties.heavy', 'Heavy'),
    });
  }
  return props;
}

function requirements(
  order: OrderLike,
  ctx: OrderViewModelContext
): DeliveryRequirement[] {
  const list: DeliveryRequirement[] = [];
  const pinOk =
    order.payment_timing !== 'pay_at_delivery' &&
    order.payment_timing !== 'pay_at_pickup' &&
    order.payment_method !== 'pay_on_delivery';
  if (pinOk && ['out_for_delivery', 'assigned_to_agent', 'picked_up', 'in_transit'].includes(order.current_status)) {
    list.push({
      id: 'pin',
      label: ctx.t('orders.delivery.requirements.pin', 'PIN required'),
    });
  }
  return list;
}

function deliveryActions(
  order: OrderLike,
  primaryId: DeliveryOrderViewModel['primaryActionId']
): OrderActionDescriptor[] {
  const actions: OrderActionDescriptor[] = [];
  const primary = actionFromPrimary(primaryId);
  if (primary) actions.push(primary);

  const s = order.current_status;
  if (['assigned_to_agent', 'picked_up', 'in_transit', 'out_for_delivery'].includes(s)) {
    actions.push({
      id: 'navigate_pickup',
      labelKey: 'orders.delivery.actions.navigate',
      labelDefault: 'Navigate',
      variant: 'contained',
    });
  }
  if (s === 'assigned_to_agent') {
    actions.push({
      id: 'drop_order',
      labelKey: 'orders.delivery.actions.unablePickup',
      labelDefault: 'Unable to Pickup',
      variant: 'danger',
    });
  }
  if (s === 'out_for_delivery') {
    actions.push({
      id: 'fail_delivery',
      labelKey: 'orders.delivery.actions.reportIssue',
      labelDefault: 'Report Issue',
      variant: 'outlined',
    });
  }
  actions.push({
    id: 'contact_business',
    labelKey: 'orders.delivery.actions.contactBusiness',
    labelDefault: 'Contact Business',
    variant: 'text',
  });
  actions.push({
    id: 'contact_customer',
    labelKey: 'orders.delivery.actions.contactCustomer',
    labelDefault: 'Contact Customer',
    variant: 'text',
  });
  return actions;
}

function weightLabel(order: OrderLike): string | null {
  const items = order.order_items ?? [];
  const total = items.reduce((sum, i) => sum + (i.item?.weight ?? 0) * (i.quantity ?? 1), 0);
  if (!total) return null;
  const unit = items.find((i) => i.item?.weight_unit)?.item?.weight_unit ?? 'kg';
  return `${total} ${unit}`;
}

export function buildDeliveryOrderViewModel(
  order: OrderLike,
  ctx: OrderViewModelContext
): DeliveryOrderViewModel {
  const phase = phaseFor(order, 'agent');
  const claimed = Boolean(order.assigned_agent_id);
  const items = mapItems(order, false);
  const nextStepMessage = phase.nextStepKey
    ? ctx.t(phase.nextStepKey, '')
    : null;
  const objectiveTitle = objective(order, ctx);

  return {
    orderId: order.id,
    orderNumber: order.order_number,
    status: order.current_status,
    statusMessage: friendlyStatus(order, 'agent', ctx),
    currentObjective: objectiveTitle,
    heroTitle: objectiveTitle,
    nextStepMessage: nextStepMessage || null,
    urgency: urgencyFor(order, ctx),
    phase: phase.phase,
    primaryActionId: phase.primaryActionId,
    stops: [
      {
        kind: 'pickup',
        title: ctx.t('orders.delivery.stops.pickup', 'Pickup location'),
        address: order.business_location?.address ?? null,
        contact: toContact(
          order.business?.user,
          order.business?.name ?? order.business_location?.name
        ),
        instructions: order.business_location?.address?.instructions ?? null,
      },
      {
        kind: 'delivery',
        title: ctx.t('orders.delivery.stops.delivery', 'Delivery location'),
        address: order.delivery_address ?? null,
        contact: claimed ? toContact(order.client?.user) : null,
        instructions:
          order.delivery_address?.instructions ??
          order.special_instructions ??
          null,
      },
    ],
    deliveryWindowLabel: deliveryWindowLabel(order, ctx),
    packageInfo: {
      items: claimed ? items : items.map((i) => ({ ...i, name: '••••' })),
      itemCount: items.reduce((s, i) => s + i.quantity, 0),
      packageCount: items.length,
      weightLabel: weightLabel(order),
      dimensionsLabel:
        order.order_items?.find((i) => i.item?.dimensions)?.item?.dimensions ??
        null,
      properties: packageProperties(order, ctx),
    },
    deliveryRequirements: requirements(order, ctx),
    earnings: {
      commission: order.delivery_commission,
      tips: order.tip_amount,
      bonuses: order.bonus_amount,
      estimatedTotal:
        (order.delivery_commission ?? 0) +
        (order.tip_amount ?? 0) +
        (order.bonus_amount ?? 0) || null,
      currency: order.currency,
    },
    distanceLabel:
      order.distance_km != null
        ? ctx.t('orders.delivery.distance', '{{km}} km', {
            km: order.distance_km.toFixed(1),
          })
        : null,
    availableActions: deliveryActions(order, phase.primaryActionId),
  };
}
