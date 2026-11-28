import type { TopInventoryStoreRow } from './inventory-items.service';

/** One seller (business location) row in the Exports seller directory. */
export interface ExportStoreRow extends TopInventoryStoreRow {
  /** ISO-2 country of the location address (null when unknown). */
  country: string | null;
  /** Newest live export listing at this location in the current context (ISO). */
  latest_export_at: string | null;
}

/** Response body of GET /inventory-items/stores?export_only=true. */
export interface ExportStoresPage {
  stores: ExportStoreRow[];
  /** Sellers matching the context and search, before limit / offset. */
  total: number;
  /** Context country: the origin (From) or the viewer market (Into). */
  country: string | null;
}

interface ExportStoreScanRow {
  item_id?: string | null;
  business_location_id?: string | null;
  created_at?: string | null;
}

export interface ExportStoreAggregate {
  item_count: number;
  latest_export_at: string | null;
}

/** Distinct export items and newest listing per business location. */
export function aggregateExportStoreRows(
  rows: ExportStoreScanRow[]
): Map<string, ExportStoreAggregate> {
  const byLoc = new Map<string, { items: Set<string>; latest: string | null }>();
  for (const row of rows) {
    const locId = row?.business_location_id;
    const itemId = row?.item_id;
    if (!locId || !itemId) continue;
    const acc = byLoc.get(locId) ?? { items: new Set<string>(), latest: null };
    acc.items.add(String(itemId));
    const at = row.created_at ?? null;
    if (at && (!acc.latest || Date.parse(at) > Date.parse(acc.latest))) {
      acc.latest = at;
    }
    byLoc.set(locId, acc);
  }
  const out = new Map<string, ExportStoreAggregate>();
  for (const [id, acc] of byLoc) {
    out.set(id, { item_count: acc.items.size, latest_export_at: acc.latest });
  }
  return out;
}

function recencyMs(at: string | null): number {
  const ms = at ? Date.parse(at) : Number.NaN;
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Seller order: export item count desc, then newest export listing, then name (A–Z).
 * Never distance or GPS.
 */
export function compareExportStores(
  a: Pick<ExportStoreRow, 'item_count' | 'latest_export_at' | 'name'>,
  b: Pick<ExportStoreRow, 'item_count' | 'latest_export_at' | 'name'>
): number {
  if (a.item_count !== b.item_count) return b.item_count - a.item_count;
  const ra = recencyMs(a.latest_export_at);
  const rb = recencyMs(b.latest_export_at);
  if (ra !== rb) return rb - ra;
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

/** Clamp the seller page size (default 20, max 50) and offset (>= 0). */
export function clampExportStoresWindow(
  limit?: string,
  offset?: string
): { limit: number; offset: number } {
  const n = Number.parseInt(limit ?? '', 10);
  const o = Number.parseInt(offset ?? '', 10);
  return {
    limit: Number.isFinite(n) ? Math.min(Math.max(n, 1), 50) : 20,
    offset: Number.isFinite(o) && o > 0 ? o : 0,
  };
}
