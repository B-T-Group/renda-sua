import type { Order } from '../types/agent';

export function orderModifiedAtMs(o: Pick<Order, 'updated_at' | 'created_at'>): number {
  const raw = (o.updated_at || o.created_at || '').trim();
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export function sortOrdersByModifiedDesc<T extends Pick<Order, 'updated_at' | 'created_at'>>(orders: T[]): T[] {
  return [...orders].sort((a, b) => orderModifiedAtMs(b) - orderModifiedAtMs(a));
}
