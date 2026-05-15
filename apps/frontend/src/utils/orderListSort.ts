export function orderModifiedAtMs(o: { updated_at?: string; created_at?: string }): number {
  const raw = (o.updated_at || o.created_at || '').trim();
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export function sortOrdersByModifiedDesc<
  T extends { updated_at?: string; created_at?: string },
>(orders: T[]): T[] {
  return [...orders].sort((a, b) => orderModifiedAtMs(b) - orderModifiedAtMs(a));
}
