import type { BusinessOrder } from '../types/business/orders';
import {
  businessCanPrintLabel,
  businessMayCancelDeferredUncollectedOrder,
  businessMayCancelOrder,
} from './businessOrderUtils';
import { isCarrierShipping } from './fulfillmentMethod';

export type BusinessOrderActionId =
  | 'confirm'
  | 'completePreparation'
  | 'completeOrder'
  | 'cancel'
  | 'manageRefunds'
  | 'reconcileCash'
  | 'generateOverwriteCode'
  | 'requestPickupPayment'
  | 'confirmClientPickup'
  | 'printLabel'
  | 'markShipped'
  | 'updateTracking';

export interface BusinessOrderAction {
  id: BusinessOrderActionId;
  labelKey: string;
  defaultLabel: string;
  destructive?: boolean;
  primary?: boolean;
}

const DELEGATE_HIDDEN_ACTIONS = new Set<BusinessOrderActionId>([
  'reconcileCash',
  'manageRefunds',
  'generateOverwriteCode',
  'completeOrder',
  'printLabel',
]);

export function getBusinessOrderActions(
  order: BusinessOrder,
  options?: { mode?: 'owner' | 'delegate' }
): BusinessOrderAction[] {
  const mode = options?.mode ?? 'owner';
  if (isCarrierShipping(order.fulfillment_method)) {
    return filterDelegateActions(shippingOrderActions(order), mode);
  }
  return filterDelegateActions(standardOrderActions(order, mode), mode);
}

function filterDelegateActions(
  actions: BusinessOrderAction[],
  mode: 'owner' | 'delegate'
): BusinessOrderAction[] {
  return mode === 'delegate'
    ? actions.filter((a) => !DELEGATE_HIDDEN_ACTIONS.has(a.id))
    : actions;
}

function shippingOrderActions(order: BusinessOrder): BusinessOrderAction[] {
  const status = order.current_status;
  if (status === 'pending') return pendingShippingActions();
  if (status === 'confirmed' || status === 'preparing' || status === 'awaiting_shipment') {
    return readyToShipActions(order);
  }
  if (status === 'shipped' || status === 'in_delivery') {
    return shippedTrackingActions();
  }
  return [];
}

function pendingShippingActions(): BusinessOrderAction[] {
  return [
    { id: 'confirm', labelKey: 'orderActions.confirmOrder', defaultLabel: 'Confirm order', primary: true },
    { id: 'cancel', labelKey: 'orderActions.cancelOrder', defaultLabel: 'Cancel order', destructive: true },
  ];
}

function readyToShipActions(order: BusinessOrder): BusinessOrderAction[] {
  const actions: BusinessOrderAction[] = [
    {
      id: 'markShipped',
      labelKey: 'orders.shipping.markShipped',
      defaultLabel: 'Mark as shipped',
      primary: true,
    },
  ];
  if (businessMayCancelOrder(order)) {
    actions.push({
      id: 'cancel',
      labelKey: 'orderActions.cancelOrder',
      defaultLabel: 'Cancel order',
      destructive: true,
    });
  }
  return actions;
}

function shippedTrackingActions(): BusinessOrderAction[] {
  return [
    {
      id: 'updateTracking',
      labelKey: 'orders.shipping.updateTracking',
      defaultLabel: 'Update tracking',
      primary: true,
    },
  ];
}

function pickupPaymentNeedsCollection(order: BusinessOrder): boolean {
  return (
    order.fulfillment_method === 'pickup' &&
    order.payment_timing === 'pay_at_pickup' &&
    order.payment_status !== 'paid' &&
    order.payment_status !== 'authorized'
  );
}

function standardOrderActions(
  order: BusinessOrder,
  mode: 'owner' | 'delegate'
): BusinessOrderAction[] {
  const actions: BusinessOrderAction[] = [];

  if (
    mode === 'owner' &&
    order.reconciliation_status === 'pending_manual_reconciliation'
  ) {
    actions.push({
      id: 'reconcileCash',
      labelKey: 'business.orders.reconcileCash',
      defaultLabel: 'Reconcile cash exception',
      primary: true,
    });
  }

  switch (order.current_status) {
    case 'pending':
      actions.push(
        {
          id: 'confirm',
          labelKey: 'orderActions.confirmOrder',
          defaultLabel: 'Confirm order',
          primary: true,
        },
        {
          id: 'cancel',
          labelKey: 'orderActions.cancelOrder',
          defaultLabel: 'Cancel order',
          destructive: true,
        }
      );
      break;
    case 'confirmed':
      actions.push({
        id: 'completePreparation',
        labelKey: 'orderActions.readyForPickup',
        defaultLabel: 'Set as ready',
        primary: true,
      });
      if (businessMayCancelOrder(order)) {
        actions.push({
          id: 'cancel',
          labelKey: 'orderActions.cancelOrder',
          defaultLabel: 'Cancel order',
          destructive: true,
        });
      }
      break;
    case 'preparing':
      actions.push({
        id: 'completePreparation',
        labelKey: 'orderActions.completePreparation',
        defaultLabel: 'Complete preparation',
        primary: true,
      });
      if (businessMayCancelOrder(order)) {
        actions.push({
          id: 'cancel',
          labelKey: 'orderActions.cancelOrder',
          defaultLabel: 'Cancel order',
          destructive: true,
        });
      }
      break;
    case 'out_for_delivery':
      if (mode === 'owner') {
        actions.push({
          id: 'generateOverwriteCode',
          labelKey: 'business.orders.generateOverwriteCode',
          defaultLabel: 'Generate overwrite code',
        });
      }
      break;
    case 'ready_for_pickup':
      if (pickupPaymentNeedsCollection(order)) {
        actions.push({
          id: 'requestPickupPayment',
          labelKey: 'orderActions.requestPickupPayment',
          defaultLabel: 'Request pickup payment',
          primary: true,
        });
      }
      if (
        order.fulfillment_method === 'pickup' &&
        order.payment_timing !== 'pay_at_pickup' &&
        (order.payment_status === 'authorized' ||
          order.payment_status === 'paid')
      ) {
        actions.push({
          id: 'confirmClientPickup',
          labelKey: 'orderActions.confirmClientPickup',
          defaultLabel: 'Confirm pickup',
          primary: true,
        });
      }
      break;
    case 'delivered':
      if (mode === 'owner') {
        actions.push({
          id: 'completeOrder',
          labelKey: 'orders.actions.completeOrder',
          defaultLabel: 'Complete order',
          primary: true,
        });
      }
      break;
    case 'complete':
      break;
    case 'refund_requested':
      if (mode === 'owner') {
        actions.push({
          id: 'manageRefunds',
          labelKey: 'orders.refunds.manageInDashboard',
          defaultLabel: 'Manage refund request',
          primary: true,
        });
      }
      break;
    case 'failed':
    case 'cancelled':
      break;
    default:
      break;
  }

  const hasCancel = actions.some((a) => a.id === 'cancel');
  if (businessMayCancelDeferredUncollectedOrder(order) && !hasCancel) {
    actions.push({
      id: 'cancel',
      labelKey: 'orderActions.cancelOrder',
      defaultLabel: 'Cancel order',
      destructive: true,
    });
  }

  if (mode === 'owner' && businessCanPrintLabel(order)) {
    actions.push({
      id: 'printLabel',
      labelKey: 'orderActions.printLabel',
      defaultLabel: 'Print label',
    });
  }

  return actions;
}
