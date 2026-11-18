/** Repeat pages reuse this order. Long enough to cover a scroll, short enough to pick up edits. */
export const RENTAL_SEARCH_ID_CACHE_TTL_MS = 45_000;

/** Caps resident markets. Each entry holds ids only, not listing payloads. */
export const RENTAL_SEARCH_ID_CACHE_MAX = 32;

export interface RentalSearchOrderKeyInput {
  country?: string | null;
  state?: string | null;
  q?: string | null;
  categoryId?: string | null;
  sort?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  operationMode?: string | null;
  rankingEnabled: boolean;
  cardGuardEnabled: boolean;
}

export interface CachedSearchOrder {
  ids: string[];
  availableCount: number;
  storedAt: number;
}

/**
 * Public filters only. Page and limit are not part of the order.
 * No auth token, user id, or other secret belongs in this string.
 */
export function rentalSearchOrderKey(input: RentalSearchOrderKeyInput): string {
  return [
    'v1',
    text(input.country).toUpperCase(),
    text(input.state).toLowerCase(),
    text(input.q).toLowerCase(),
    text(input.categoryId),
    text(input.sort) || 'recommended',
    bound(input.minPrice),
    bound(input.maxPrice),
    text(input.startDate),
    text(input.endDate),
    text(input.operationMode),
    input.rankingEnabled ? '1' : '0',
    input.cardGuardEnabled ? '1' : '0',
  ].join('|');
}

export function listingsInIdOrder<T extends { id: string }>(ids: string[], rows: T[]): T[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const ordered: T[] = [];
  for (const id of ids) {
    const row = byId.get(id);
    if (row) ordered.push(row);
  }
  return ordered;
}

export class RentalSearchIdCache {
  private readonly entries = new Map<string, CachedSearchOrder>();

  constructor(
    private readonly maxEntries = RENTAL_SEARCH_ID_CACHE_MAX,
    private readonly ttlMs = RENTAL_SEARCH_ID_CACHE_TTL_MS,
    private readonly now: () => number = Date.now
  ) {}

  get(key: string): CachedSearchOrder | null {
    const hit = this.entries.get(key);
    if (!hit) return null;
    this.entries.delete(key);
    if (this.now() - hit.storedAt >= this.ttlMs) return null;
    this.entries.set(key, hit);
    return hit;
  }

  set(key: string, value: { ids: string[]; availableCount: number }): void {
    this.entries.delete(key);
    this.entries.set(key, { ...value, storedAt: this.now() });
    this.evict();
  }

  get size(): number {
    return this.entries.size;
  }

  private evict(): void {
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) return;
      this.entries.delete(oldest);
    }
  }
}

function text(value?: string | null): string {
  return (value ?? '').trim();
}

function bound(value?: number | null): string {
  if (value == null || !Number.isFinite(Number(value))) return '';
  return String(Number(value));
}
