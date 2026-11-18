import { geoStateKey } from '../rbac/geo-state.util';

/** Repeat pages reuse this order. Long enough to cover a scroll, short enough to pick up edits. */
export const RENTAL_SEARCH_ID_CACHE_TTL_MS = 45_000;

/**
 * Default lists (no free-text q). A 50k-id entry is about 4.8 MB, so 16 entries
 * cap this bucket near 77 MB. Searches cannot evict these.
 */
export const RENTAL_SEARCH_LIST_CACHE_MAX = 16;

/** Free-text q keys. Four entries cannot push a default list out. */
export const RENTAL_SEARCH_QUERY_CACHE_MAX = 4;

/**
 * Each q entry is refused above this many ids.
 * 4 × 2,000 ids is about 0.8 MB at the same density as a 50k list (~96 bytes/id).
 * Together with the default-list budget the process cap is about 78 MB.
 */
export const RENTAL_SEARCH_QUERY_ID_CAP = 2_000;

export interface RentalSearchOrderKeyInput {
  country?: string | null;
  state?: string | null;
  filterMode?: 'specific' | 'supported_only';
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

export interface SearchMarket {
  country?: string;
  state?: string;
  filterMode: 'specific' | 'supported_only';
  degraded: boolean;
}

export interface CachedSearchOrder {
  ids: string[];
  availableCount: number;
  storedAt: number;
}

export interface StoredMarketRow {
  country_code: string;
  state_name: string;
  state_key?: string | null;
}

export interface ListingVisibility {
  is_active?: boolean;
  deleted_at?: string | null;
  base_price_per_hour: number | string;
  business_location?: {
    is_active?: boolean;
    address?: { country?: string | null; state?: string | null };
  };
  rental_item?: { is_active?: boolean; deleted_at?: string | null };
}

/** Same country and state the query will use. Two-letter codes match the stored ISO form. */
export function marketFromQuery(country?: string | null, state?: string | null): SearchMarket {
  const code = normalizeCountry(country);
  const region = text(state) || undefined;
  const filterMode = code || region ? 'specific' : 'supported_only';
  return { country: code, state: region, filterMode, degraded: false };
}

/** Prefer the row the database stores so the where-clause and the cache key cannot disagree. */
export function pickStoredMarket(rows: StoredMarketRow[], country?: string, state?: string): {
  country?: string;
  state?: string;
} {
  const stateRow = state ? rows.find((row) => sameState(row, country, state)) : undefined;
  const countryRow = country ? rows.find((row) => sameCountry(row.country_code, country)) : undefined;
  return { country: stateRow?.country_code ?? countryRow?.country_code, state: stateRow?.state_name };
}

/** Warm pages drop a row that would no longer be in a fresh catalog query. */
export function listingStillPublic(
  row: ListingVisibility,
  scope: { minPrice?: number | null; maxPrice?: number | null; country?: string; state?: string }
): boolean {
  if (row.is_active === false || row.deleted_at) return false;
  if (row.business_location?.is_active === false) return false;
  if (row.rental_item?.deleted_at || row.rental_item?.is_active === false) return false;
  if (!hourPriceInRange(row.base_price_per_hour, scope.minPrice, scope.maxPrice)) return false;
  return addressMatches(row.business_location?.address, scope.country, scope.state);
}

/**
 * Public filters only. Page and limit are not part of the order.
 * JSON keeps a value that contains `|` from colliding with the next field.
 * No auth token, user id, or other secret belongs in this string.
 */
export function rentalSearchOrderKey(input: RentalSearchOrderKeyInput): string {
  const country = text(input.country);
  const state = text(input.state);
  const filterMode = input.filterMode ?? (country || state ? 'specific' : 'supported_only');
  return JSON.stringify(keyParts(input, country, state, filterMode));
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
  private readonly lists = new Map<string, CachedSearchOrder>();
  private readonly queries = new Map<string, CachedSearchOrder>();

  constructor(
    private readonly listMax = RENTAL_SEARCH_LIST_CACHE_MAX,
    private readonly ttlMs = RENTAL_SEARCH_ID_CACHE_TTL_MS,
    private readonly now: () => number = Date.now,
    private readonly queryMax = RENTAL_SEARCH_QUERY_CACHE_MAX,
    private readonly queryIdCap = RENTAL_SEARCH_QUERY_ID_CAP
  ) {}

  get(key: string, queried = false): CachedSearchOrder | null {
    const bucket = this.bucket(queried);
    const hit = bucket.get(key);
    if (!hit) return null;
    bucket.delete(key);
    if (this.now() - hit.storedAt >= this.ttlMs) return null;
    bucket.set(key, hit);
    return hit;
  }

  set(key: string, value: { ids: string[]; availableCount: number }, queried = false): void {
    if (!value.ids.length) return;
    if (queried && value.ids.length > this.queryIdCap) return;
    const bucket = this.bucket(queried);
    bucket.delete(key);
    bucket.set(key, { ...value, storedAt: this.now() });
    this.evict(bucket, queried ? this.queryMax : this.listMax);
  }

  delete(key: string, queried = false): void {
    this.bucket(queried).delete(key);
  }

  get size(): number {
    return this.lists.size + this.queries.size;
  }

  private bucket(queried: boolean): Map<string, CachedSearchOrder> {
    return queried ? this.queries : this.lists;
  }

  private evict(bucket: Map<string, CachedSearchOrder>, max: number): void {
    while (bucket.size > max) {
      const oldest = bucket.keys().next().value;
      if (oldest === undefined) return;
      bucket.delete(oldest);
    }
  }
}

function keyParts(
  input: RentalSearchOrderKeyInput,
  country: string,
  state: string,
  filterMode: string
): Array<string | number> {
  return [
    'v2',
    country,
    state,
    filterMode,
    text(input.q).toLowerCase(),
    text(input.categoryId),
    text(input.sort) || 'recommended',
    bound(input.minPrice),
    bound(input.maxPrice),
    text(input.startDate),
    text(input.endDate),
    text(input.operationMode),
    input.rankingEnabled ? 1 : 0,
    input.cardGuardEnabled ? 1 : 0,
  ];
}

function normalizeCountry(value?: string | null): string | undefined {
  const trimmed = text(value);
  if (!trimmed) return undefined;
  return trimmed.length <= 3 ? trimmed.toUpperCase() : trimmed;
}

function sameCountry(stored: string, requested: string): boolean {
  return stored.trim().toUpperCase() === requested.trim().toUpperCase();
}

function sameState(row: StoredMarketRow, country: string | undefined, state: string): boolean {
  if (country && !sameCountry(row.country_code, country)) return false;
  if (row.state_name.trim().toLowerCase() === state.trim().toLowerCase()) return true;
  const key = row.state_key?.trim();
  return Boolean(key) && key === geoStateKey(state);
}

function addressMatches(
  address: { country?: string | null; state?: string | null } | undefined,
  country?: string,
  state?: string
): boolean {
  if (country && !sameCountry(address?.country ?? '', country)) return false;
  if (!state) return true;
  return (address?.state ?? '').trim().toLowerCase() === state.trim().toLowerCase();
}

function hourPriceInRange(raw: number | string, minPrice?: number | null, maxPrice?: number | null): boolean {
  const min = finiteBound(minPrice);
  const max = finiteBound(maxPrice);
  if (min == null && max == null) return true;
  const price = typeof raw === 'number' ? raw : parseFloat(String(raw)) || 0;
  if (min != null && price < min) return false;
  return max == null || price <= max;
}

function finiteBound(value?: number | null): number | null {
  if (value == null || Number.isNaN(Number(value))) return null;
  return Number(value);
}

function text(value?: string | null): string {
  return (value ?? '').trim();
}

function bound(value?: number | null): string {
  if (value == null || !Number.isFinite(Number(value))) return '';
  return String(Number(value));
}
