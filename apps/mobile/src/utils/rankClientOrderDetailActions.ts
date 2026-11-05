import type { Order } from '../types/agent';
import {
  clientCanAskIfReady,
  clientCanCancelOrder,
  clientCanConfirmReceipt,
  clientShowDeliveryPin,
  clientShowNoAgentOptions,
} from './clientOrderActions';
import { clientCanShowConfirmReceipt } from './deliveryConfirmationUi';
import { isStorePickupOrder } from './businessOrderListDisplay';
import { isOrderRefundRequestAllowed } from './orderRefundWindow';
import {
  orderToPhaseInput,
  resolveOrderPhase,
  type OrderPrimaryActionId,
} from './orderPhase';
import {
  rankOrderDetailActions,
  type RankedOrderAction,
  type RankedOrderActions,
} from './rankOrderDetailActions';

export type ClientOrderDetailActionId =
  | OrderPrimaryActionId
  | 'reorder'
  | 'ask_if_ready'
  | 'switch_to_pickup'
  | 'request_refund'
  | 'report_problem'
  | 'cancel';

export type RankClientOrderDetailOptions = {
  canRate?: boolean;
  reorderEnabled?: boolean;
  /** When true, confirm_receipt is handled by a dedicated card — skip sticky. */
  confirmReceiptOnCard?: boolean;
  usesLegacyPin?: boolean | null;
};

const LABEL: Record<
  string,
  { labelKey: string; defaultLabel: string; destructive?: boolean }
> = {
  pay: { labelKey: 'orders.actions.payNow', defaultLabel: 'Pay now' },
  send_pin: { labelKey: 'orders.sendPin', defaultLabel: 'Send PIN' },
  rate: { labelKey: 'orders.actions.rate', defaultLabel: 'Rate order' },
  complete: {
    labelKey: 'orders.actions.completeOrder',
    defaultLabel: 'Complete order',
  },
  confirm_receipt: {
    labelKey: 'orderActions.confirmReceipt',
    defaultLabel: 'Confirm receipt',
  },
  reorder: { labelKey: 'orders.reorder.cta', defaultLabel: 'Reorder' },
  cancel: {
    labelKey: 'orderActions.cancelOrder',
    defaultLabel: 'Cancel order',
    destructive: true,
  },
  ask_if_ready: {
    labelKey: 'orderActions.askIfReady',
    defaultLabel: 'Ask if my order is ready',
  },
  switch_to_pickup: {
    labelKey: 'orders.noAgent.switchToPickup',
    defaultLabel: 'Switch to store pickup',
  },
  request_refund: {
    labelKey: 'orders.refunds.requestButton',
    defaultLabel: 'Request refund',
  },
  report_problem: {
    labelKey: 'orders.clientConfirm.reportProblem',
    defaultLabel: 'Report a problem',
    destructive: true,
  },
};

function push(
  list: RankedOrderAction[],
  id: string,
  preferred?: boolean
): void {
  const meta = LABEL[id];
  if (!meta) return;
  if (list.some((a) => a.id === id)) return;
  list.push({
    id,
    labelKey: meta.labelKey,
    defaultLabel: meta.defaultLabel,
    destructive: meta.destructive,
    preferred,
  });
}

/** Gather every legal client sticky/More action for the current order. */
export function listClientOrderDetailActions(
  order: Order,
  options: RankClientOrderDetailOptions = {}
): RankedOrderAction[] {
  const usesLegacyPin = options.usesLegacyPin === true;
  const phase = resolveOrderPhase(
    orderToPhaseInput(order, { usesLegacyPin }),
    'client'
  );
  const actions: RankedOrderAction[] = [];
  const pickup = isStorePickupOrder(order);
  const canConfirmDelivery = clientCanShowConfirmReceipt({
    fulfillmentMethod: order.fulfillment_method,
    status: order.current_status,
    usesLegacyPin: usesLegacyPin === true,
    isGift: Boolean(
      (order as { is_gift?: boolean }).is_gift ||
        (order as { is_third_party_recipient?: boolean }).is_third_party_recipient
    ),
    paymentTiming: order.payment_timing,
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
    payAfterMerchantConfirm: order.pay_after_merchant_confirm,
  });

  if (options.reorderEnabled) {
    push(actions, 'reorder', true);
  }

  const primaryId = phase.primaryActionId;
  if (primaryId === 'pay') {
    push(actions, 'pay', !options.reorderEnabled);
  } else if (primaryId === 'send_pin' && clientShowDeliveryPin(order, usesLegacyPin === true)) {
    push(actions, 'send_pin', !options.reorderEnabled);
  } else if (primaryId === 'rate' && options.canRate) {
    push(actions, 'rate', !options.reorderEnabled);
  } else if (primaryId === 'complete') {
    push(actions, 'complete', !options.reorderEnabled);
  } else if (
    primaryId === 'confirm_receipt' &&
    !options.confirmReceiptOnCard &&
    !canConfirmDelivery
  ) {
    push(actions, 'confirm_receipt', !options.reorderEnabled);
  }

  if (
    pickup &&
    order.current_status === 'ready_for_pickup' &&
    (order.payment_status === 'paid' || order.payment_status === 'authorized') &&
    !actions.some((a) => a.id === 'complete')
  ) {
    push(actions, 'complete', actions.every((a) => !a.preferred));
  }

  if (clientCanConfirmReceipt(order) && !actions.some((a) => a.id === 'confirm_receipt')) {
    push(actions, 'confirm_receipt');
  }

  if (canConfirmDelivery && !options.confirmReceiptOnCard) {
    push(actions, 'confirm_receipt', actions.every((a) => !a.preferred));
    push(actions, 'report_problem');
  }

  if (clientCanAskIfReady(order)) {
    push(actions, 'ask_if_ready');
  }

  if (clientShowNoAgentOptions(order)) {
    push(actions, 'switch_to_pickup');
  }

  if (isOrderRefundRequestAllowed(order.completed_at)) {
    push(actions, 'request_refund');
  }

  if (clientCanCancelOrder(order)) {
    push(actions, 'cancel');
  }

  return actions;
}

/** Sticky-bar ranking for client order detail. */
export function rankClientOrderDetailActions(
  order: Order,
  options: RankClientOrderDetailOptions = {}
): RankedOrderActions {
  const actions = listClientOrderDetailActions(order, options);
  const preferred = actions.find((a) => a.preferred)?.id ?? null;
  return rankOrderDetailActions(actions, preferred);
}
