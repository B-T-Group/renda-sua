import type { TFunction } from 'i18next';
import type { Order } from '../types/agent';

function resolveIso4217Currency(order: Order): string {
  const raw = (order.currency ?? '').trim().toUpperCase();
  if (raw.length === 3 && /^[A-Z]{3}$/.test(raw)) {
    return raw;
  }
  return 'XAF';
}

export function buildAgentClaimConfirmBody(order: Order, holdAmount: number, t: TFunction): string {
  const commission = order.delivery_commission ?? order.base_delivery_fee ?? 0;
  const currency = resolveIso4217Currency(order);
  const formatCur = (n: number) =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number.isFinite(n) ? n : 0);
  let extra = '';
  if (commission > 0) {
    extra += t('orders.deliveryCommission', { defaultValue: 'Delivery commission' }) + ': ' + formatCur(commission);
  }
  if (holdAmount > 0) {
    const holdLine = t('orders.claimOrderHoldAmountInfo', {
      holdAmount: formatCur(holdAmount),
      defaultValue:
        'Please note: {{holdAmount}} will be withheld from your account as a guarantee. Released after successful delivery.',
    });
    extra += extra ? '\n' + holdLine : holdLine;
  }
  const baseMsg = t('orders.confirmClaimOrderMessage', {
    orderNumber: String(order.order_number ?? ''),
    defaultValue: 'Are you sure you want to claim order #{{orderNumber}}?',
  });
  return extra ? baseMsg + '\n\n' + extra : baseMsg;
}
