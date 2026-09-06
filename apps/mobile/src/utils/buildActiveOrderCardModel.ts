import {
  orderToPhaseInput,
  resolveOrderPhase,
  type OrderPhase,
  type OrderPrimaryActionId,
} from './orderPhase';
import {
  isCancelledOrderStatus,
  isCompletedOrderStatus,
  isTerminalOrderStatus,
} from './orderListGrouping';
import { businessOrderUnitsCount } from './businessOrderListDisplay';
import { formatCurrency } from './formatters';
import type { BusinessOrder } from '../types/business/orders';

export type ActiveOrderCardUrgency = 'warning' | 'primary' | 'info' | 'neutral';

export type ActiveOrderCardDestination =
  | { kind: 'order_detail' }
  | { kind: 'incoming_overlay' }
  | { kind: 'refunds' }
  /** Run the merchant primary action on the dashboard (mark ready, pickup, etc.). */
  | { kind: 'perform_action' };

export interface ActiveOrderCardModel {
  orderId: string;
  orderNumber: string;
  customerName: string | null;
  itemCount: number;
  totalLabel: string;
  status: string;
  phase: OrderPhase;
  primaryActionId: OrderPrimaryActionId;
  titleKey: string;
  titleDefault: string;
  subtitleKey: string;
  subtitleDefault: string;
  ctaKey: string;
  ctaDefault: string;
  urgency: ActiveOrderCardUrgency;
  createdAt: string;
  destination: ActiveOrderCardDestination;
}

type TFn = (
  key: string,
  defaultValue?: string,
  options?: Record<string, unknown>
) => string;

function customerName(order: BusinessOrder): string | null {
  const u = order.client?.user;
  if (!u) return null;
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
  return name || null;
}

function isPickup(order: BusinessOrder): boolean {
  return (
    order.fulfillment_method === 'pickup' ||
    order.payment_timing === 'pay_at_pickup'
  );
}

function phaseTitle(
  status: string,
  phase: OrderPhase
): { key: string; defaultValue: string } {
  if (status === 'pending') {
    return {
      key: 'business.dashboard.activeOrders.titles.newOrder',
      defaultValue: 'New Order',
    };
  }
  if (phase === 'prepare') {
    return {
      key: 'business.dashboard.activeOrders.titles.preparing',
      defaultValue: 'Preparing Order',
    };
  }
  if (status === 'ready_for_pickup') {
    return {
      key: 'business.dashboard.activeOrders.titles.ready',
      defaultValue: 'Ready for Pickup',
    };
  }
  if (status === 'assigned_to_agent') {
    return {
      key: 'business.dashboard.activeOrders.titles.agentAssigned',
      defaultValue: 'Delivery Agent Assigned',
    };
  }
  if (
    status === 'picked_up' ||
    status === 'in_transit' ||
    status === 'out_for_delivery'
  ) {
    return {
      key: 'business.dashboard.activeOrders.titles.outForDelivery',
      defaultValue: 'Out for Delivery',
    };
  }
  if (status === 'refund_requested') {
    return {
      key: 'business.dashboard.activeOrders.titles.refund',
      defaultValue: 'Refund Requested',
    };
  }
  return {
    key: 'business.dashboard.activeOrders.titles.active',
    defaultValue: 'Active Order',
  };
}

function phaseSubtitle(
  status: string,
  phase: OrderPhase,
  pickup: boolean
): { key: string; defaultValue: string } {
  if (status === 'pending') {
    return {
      key: 'business.dashboard.activeOrders.subtitles.newOrder',
      defaultValue: 'A customer is waiting for your response.',
    };
  }
  if (phase === 'prepare') {
    return {
      key: 'business.dashboard.activeOrders.subtitles.preparing',
      defaultValue: 'Continue preparing this order.',
    };
  }
  if (status === 'ready_for_pickup' && pickup) {
    return {
      key: 'business.dashboard.activeOrders.subtitles.readyPickup',
      defaultValue: 'Customer can pick up when ready.',
    };
  }
  if (status === 'ready_for_pickup') {
    return {
      key: 'business.dashboard.activeOrders.subtitles.readyDelivery',
      defaultValue: 'Waiting for a delivery agent.',
    };
  }
  if (status === 'assigned_to_agent') {
    return {
      key: 'business.dashboard.activeOrders.subtitles.agentAssigned',
      defaultValue: 'The driver is on the way to pick up.',
    };
  }
  if (
    status === 'picked_up' ||
    status === 'in_transit' ||
    status === 'out_for_delivery'
  ) {
    return {
      key: 'business.dashboard.activeOrders.subtitles.outForDelivery',
      defaultValue: 'The customer is waiting.',
    };
  }
  if (status === 'refund_requested') {
    return {
      key: 'business.dashboard.activeOrders.subtitles.refund',
      defaultValue: 'Review and resolve this refund request.',
    };
  }
  return {
    key: 'business.dashboard.activeOrders.subtitles.active',
    defaultValue: 'Track this order.',
  };
}

function ctaFor(
  status: string,
  phase: OrderPhase,
  primaryActionId: OrderPrimaryActionId,
  pickup: boolean,
  pendingCash: boolean,
  acceptanceState?: string | null
): { key: string; defaultValue: string; destination: ActiveOrderCardDestination } {
  if (pendingCash) {
    return {
      key: 'business.dashboard.activeOrders.cta.reconcileCash',
      defaultValue: 'Reconcile Cash',
      destination: { kind: 'perform_action' },
    };
  }
  if (status === 'refund_requested' || primaryActionId === 'open_refunds') {
    return {
      key: 'business.dashboard.activeOrders.cta.manageRefund',
      defaultValue: 'Manage Refund',
      destination: { kind: 'refunds' },
    };
  }
  if (status === 'pending' || primaryActionId === 'confirm') {
    if (acceptanceState === 'scheduled') {
      return {
        key: 'business.dashboard.activeOrders.cta.openOrder',
        defaultValue: 'Open Order',
        destination: { kind: 'order_detail' },
      };
    }
    return {
      key: 'business.dashboard.activeOrders.cta.accept',
      defaultValue: 'Accept Order',
      destination: { kind: 'incoming_overlay' },
    };
  }
  if (phase === 'prepare') {
    return {
      key: 'business.dashboard.activeOrders.cta.markReady',
      defaultValue: 'Mark Ready',
      destination: { kind: 'perform_action' },
    };
  }
  if (status === 'ready_for_pickup' && pickup) {
    if (primaryActionId === 'collect_pickup_payment') {
      return {
        key: 'business.dashboard.activeOrders.cta.collectPayment',
        defaultValue: 'Collect Payment',
        destination: { kind: 'perform_action' },
      };
    }
    return {
      key: 'business.dashboard.activeOrders.cta.confirmPickup',
      defaultValue: 'Confirm Pickup',
      destination: { kind: 'perform_action' },
    };
  }
  if (status === 'ready_for_pickup') {
    return {
      key: 'business.dashboard.activeOrders.cta.viewStatus',
      defaultValue: 'View Status',
      destination: { kind: 'order_detail' },
    };
  }
  if (
    status === 'assigned_to_agent' ||
    status === 'picked_up' ||
    status === 'in_transit' ||
    status === 'out_for_delivery'
  ) {
    return {
      key: 'business.dashboard.activeOrders.cta.trackDelivery',
      defaultValue: 'Track Delivery',
      destination: { kind: 'order_detail' },
    };
  }
  return {
    key: 'business.dashboard.activeOrders.cta.openOrder',
    defaultValue: 'Open Order',
    destination: { kind: 'order_detail' },
  };
}

function urgencyFor(status: string, phase: OrderPhase): ActiveOrderCardUrgency {
  if (status === 'pending' || status === 'refund_requested') return 'warning';
  if (phase === 'prepare') return 'primary';
  if (phase === 'in_delivery' || status === 'ready_for_pickup') return 'info';
  return 'neutral';
}

export function isActiveOrderStatus(status: string | null | undefined): boolean {
  const s = status || '';
  if (isTerminalOrderStatus(s)) return false;
  return !isCompletedOrderStatus(s) && !isCancelledOrderStatus(s);
}

export function sortActiveOrders(orders: BusinessOrder[]): BusinessOrder[] {
  return [...orders].sort((a, b) => {
    const aAction =
      resolveOrderPhase(orderToPhaseInput(a), 'business').hubGroup ===
      'action_needed'
        ? 0
        : 1;
    const bAction =
      resolveOrderPhase(orderToPhaseInput(b), 'business').hubGroup ===
      'action_needed'
        ? 0
        : 1;
    if (aAction !== bAction) return aAction - bAction;
    return (
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  });
}

export function buildActiveOrderCardModel(
  order: BusinessOrder,
  t: TFn,
  locale = 'en-US'
): ActiveOrderCardModel {
  const status = order.current_status || '';
  const phaseInfo = resolveOrderPhase(orderToPhaseInput(order), 'business');
  const pickup = isPickup(order);
  const pendingCash =
    order.reconciliation_status === 'pending_manual_reconciliation';
  const title = phaseTitle(status, phaseInfo.phase);
  const subtitle = phaseSubtitle(status, phaseInfo.phase, pickup);
  const cta = ctaFor(
    status,
    phaseInfo.phase,
    phaseInfo.primaryActionId,
    pickup,
    pendingCash,
    order.acceptance_state
  );
  const itemCount = businessOrderUnitsCount(order);
  const total = order.total_amount ?? 0;
  const currency = order.currency || 'XAF';

  return {
    orderId: order.id,
    orderNumber: order.order_number,
    customerName: customerName(order),
    itemCount,
    totalLabel: formatCurrency(total, currency, locale),
    status,
    phase: phaseInfo.phase,
    primaryActionId: phaseInfo.primaryActionId,
    titleKey: title.key,
    titleDefault: title.defaultValue,
    subtitleKey: subtitle.key,
    subtitleDefault: subtitle.defaultValue,
    ctaKey: cta.key,
    ctaDefault: cta.defaultValue,
    urgency: urgencyFor(status, phaseInfo.phase),
    createdAt: order.created_at,
    destination: cta.destination,
  };
}

/** Relative "received X ago" label keys for the active-order card. */
export function receivedAgoParts(
  createdAt: string,
  now = Date.now()
): { key: string; defaultValue: string; count?: number } {
  const diffMs = Math.max(0, now - new Date(createdAt).getTime());
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) {
    return {
      key: 'business.dashboard.activeOrders.receivedJustNow',
      defaultValue: 'Received just now',
    };
  }
  if (mins < 60) {
    return {
      key: 'business.dashboard.activeOrders.receivedMinutes',
      defaultValue: 'Received {{count}} minutes ago',
      count: mins,
    };
  }
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return {
      key: 'business.dashboard.activeOrders.receivedHours',
      defaultValue: 'Received {{count}} hours ago',
      count: hours,
    };
  }
  const days = Math.floor(hours / 24);
  return {
    key: 'business.dashboard.activeOrders.receivedDays',
    defaultValue: 'Received {{count}} days ago',
    count: days,
  };
}
