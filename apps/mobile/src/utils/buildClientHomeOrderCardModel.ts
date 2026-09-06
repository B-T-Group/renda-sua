import type { Order } from '../types/agent';
import { getClientOrderJourney } from './clientOrderJourney';
import { clientShowAgentLocation } from './clientOrderActions';
import {
  ORDER_PRIMARY_ACTION_LABEL,
  orderToPhaseInput,
  resolveOrderPhase,
  type OrderPrimaryActionId,
} from './orderPhase';

export type ClientHomeOrderCardUrgency = 'warning' | 'primary' | 'info' | 'neutral';

export interface ClientHomeOrderCardModel {
  orderId: string;
  orderNumber: string;
  status: string;
  titleKey: string;
  titleDefault: string;
  subtitleKey: string;
  subtitleDefault: string;
  ctaKey: string;
  ctaDefault: string;
  urgency: ClientHomeOrderCardUrgency;
  primaryActionId: OrderPrimaryActionId;
  interpolation: Record<string, string>;
}

function urgencyFor(
  action: OrderPrimaryActionId,
  journeyTone: string
): ClientHomeOrderCardUrgency {
  if (action === 'pay' || action === 'send_pin' || action === 'confirm_receipt') {
    return 'warning';
  }
  if (journeyTone === 'warning' || journeyTone === 'error') return 'warning';
  if (journeyTone === 'success') return 'primary';
  if (clientTrackAction(action)) return 'info';
  return 'neutral';
}

function clientTrackAction(action: OrderPrimaryActionId): boolean {
  return action === 'none';
}

function ctaFor(
  order: Order,
  action: OrderPrimaryActionId
): { key: string; defaultValue: string } {
  if (action === 'pay' && order.payment_timing === 'pay_at_pickup') {
    return { key: 'orders.payAtPickup.cta', defaultValue: 'Pay now' };
  }
  if (action !== 'none' && ORDER_PRIMARY_ACTION_LABEL[action]) {
    const [key, defaultValue] = ORDER_PRIMARY_ACTION_LABEL[action];
    if (defaultValue) return { key, defaultValue };
  }
  if (clientShowAgentLocation(order.current_status, order.fulfillment_method)) {
    return {
      key: 'client.home.liveOrders.ctaTrack',
      defaultValue: 'Track order',
    };
  }
  return {
    key: 'client.home.liveOrders.ctaView',
    defaultValue: 'View order',
  };
}

export function buildClientHomeOrderCardModel(
  order: Order
): ClientHomeOrderCardModel {
  const journey = getClientOrderJourney(order);
  const phase = resolveOrderPhase(orderToPhaseInput(order), 'client');
  const cta = ctaFor(order, phase.primaryActionId);
  const subtitleKey = journey.nextKey ?? journey.nowKey;
  const subtitleDefault = journey.nextDefault ?? journey.nowDefault;

  return {
    orderId: order.id,
    orderNumber: order.order_number,
    status: order.current_status || '',
    titleKey: journey.titleKey,
    titleDefault: journey.titleDefault,
    subtitleKey,
    subtitleDefault,
    ctaKey: cta.key,
    ctaDefault: cta.defaultValue,
    urgency: urgencyFor(phase.primaryActionId, journey.tone),
    primaryActionId: phase.primaryActionId,
    interpolation: {
      ...journey.interpolation,
      orderNumber: order.order_number,
    },
  };
}
