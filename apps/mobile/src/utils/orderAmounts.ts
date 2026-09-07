import type { Order, OrderItem } from '../types/agent';

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function sumLineItemsSubtotal(items: OrderItem[]): number {
  return items.reduce((sum, oi) => sum + lineItemAmount(oi), 0);
}

function lineItemAmount(oi: OrderItem): number {
  if (oi.total_price != null) {
    const tp = Number(oi.total_price);
    if (Number.isFinite(tp)) return tp;
  }
  const u = Number(oi.unit_price);
  const q = Number(oi.quantity) || 0;
  if (Number.isFinite(u) && q > 0) return u * q;
  return 0;
}

/**
 * Resolves display amounts when `subtotal` / fee columns are missing or zero
 * but line items or `total_amount` still carry the real totals.
 */
export function resolveOrderPricing(order: Order): {
  subtotal: number;
  deliveryFee: number;
  tax: number;
  total: number;
} {
  const items = order.order_items ?? [];
  const itemsSum = sumLineItemsSubtotal(items);
  const rawSub = order.subtotal;
  const apiSubNum = rawSub != null ? Number(rawSub) : NaN;

  let subtotal = 0;
  if (Number.isFinite(apiSubNum) && apiSubNum > 0) {
    subtotal = apiSubNum;
  } else if (itemsSum > 0) {
    subtotal = itemsSum;
  } else if (Number.isFinite(apiSubNum)) {
    subtotal = apiSubNum;
  } else {
    subtotal = itemsSum;
  }

  const rawTax = order.tax_amount != null ? Number(order.tax_amount) : 0;
  const tax = Number.isFinite(rawTax) ? rawTax : 0;

  const b = order.base_delivery_fee != null ? Number(order.base_delivery_fee) : 0;
  const p = order.per_km_delivery_fee != null ? Number(order.per_km_delivery_fee) : 0;
  const base = Number.isFinite(b) ? b : 0;
  const perKm = Number.isFinite(p) ? p : 0;
  let deliveryFee = base + perKm > 0 ? base + perKm : 0;

  const rawTotal = order.total_amount != null ? Number(order.total_amount) : NaN;

  if (deliveryFee <= 0 && Number.isFinite(rawTotal) && rawTotal > 0) {
    const inferred = rawTotal - subtotal - tax;
    if (inferred > 0.0001) {
      deliveryFee = inferred;
    }
  }

  const partsSum = subtotal + deliveryFee + tax;
  let total = Number.isFinite(rawTotal) && rawTotal > 0 ? rawTotal : partsSum;
  if ((!Number.isFinite(rawTotal) || rawTotal <= 0) && partsSum > 0) {
    total = partsSum;
  }

  return {
    subtotal: roundMoney(subtotal),
    deliveryFee: roundMoney(deliveryFee),
    tax: roundMoney(tax),
    total: roundMoney(total),
  };
}
