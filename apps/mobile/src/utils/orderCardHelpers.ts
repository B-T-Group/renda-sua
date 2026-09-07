/**
 * Helpers pour afficher les cartes commandes (alignés dashboard web).
 */

import type { Order, OrderItem, Client } from '../types/agent';

export function formatOrderAddressFull(
  addr: {
    address_line_1?: string;
    address_line_2?: string | null;
    city?: string;
    state?: string;
    postal_code?: string | null;
    country?: string;
  } | undefined
): string {
  if (!addr) return '';
  return [addr.address_line_1, addr.address_line_2, addr.city, addr.state, addr.postal_code, addr.country].filter(
    Boolean
  ).join(', ');
}

export function getTotalItemQuantity(order: Order): number {
  if (!order.order_items?.length) return 0;
  return order.order_items.reduce((sum, item) => sum + (item.quantity || 0), 0);
}

export interface ItemSpecs {
  totalWeight: number | null;
  weightUnit: string | null;
  dimensions: string[];
  isFragile: boolean;
  isPerishable: boolean;
}

export function getItemSpecs(order: Order): ItemSpecs {
  if (!order.order_items?.length) {
    return { totalWeight: null, weightUnit: null, dimensions: [], isFragile: false, isPerishable: false };
  }
  let totalWeight: number | null = null;
  let weightUnit: string | null = null;
  const dimensionsSet = new Set<string>();
  let isFragile = false;
  let isPerishable = false;

  order.order_items.forEach((oi: OrderItem) => {
    const it = oi.item;
    const qty = oi.quantity || 1;
    if (it?.weight != null) {
      totalWeight = (totalWeight ?? 0) + it.weight * qty;
      weightUnit = it.weight_unit || weightUnit || 'kg';
    }
    if (it?.dimensions) dimensionsSet.add(it.dimensions);
    if (it?.is_fragile) isFragile = true;
    if (it?.is_perishable) isPerishable = true;
  });

  return {
    totalWeight,
    weightUnit,
    dimensions: Array.from(dimensionsSet),
    isFragile,
    isPerishable,
  };
}

export function clientDisplayName(client: Client | undefined): string {
  if (!client?.user) return '';
  const { first_name, last_name } = client.user;
  return [first_name, last_name].filter(Boolean).join(' ').trim() || '';
}

/** Couleur du statut pour badges (comme web: success, warning, info, primary). */
export function getStatusColor(
  status: string
): 'success' | 'warning' | 'info' | 'primary' | 'default' {
  switch (status) {
    case 'ready_for_pickup':
      return 'success';
    case 'pending':
    case 'pending_payment':
      return 'warning';
    case 'confirmed':
    case 'preparing':
      return 'info';
    case 'assigned_to_agent':
    case 'picked_up':
    case 'in_transit':
    case 'out_for_delivery':
      return 'primary';
    case 'delivered':
    case 'complete':
      return 'success';
    case 'cancelled':
    case 'failed':
    case 'refunded':
      return 'default';
    default:
      return 'primary';
  }
}
