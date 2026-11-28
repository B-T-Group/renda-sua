import { EXPORTS_CANONICAL_ORIGIN, exportsOriginPath } from './exportsPublicLink';

/** Exports seller (business location) row from GET /inventory-items/stores?export_only=true. */
export interface ExportSeller {
  business_location_id: string;
  business_id: string;
  name: string;
  city: string | null;
  country: string | null;
  logo_url: string | null;
  item_count: number;
  latest_export_at: string | null;
}

export interface ExportSellersContext {
  direction: 'into' | 'from';
  marketCode: string | null;
  originCode: string | null;
}

/** Carousel shows at most this many cards, then a More card when total is larger. */
export const EXPORT_SELLERS_CAROUSEL_MAX = 10;

/** Monogram tints: brand blue first, then navy / teal / green. No purple (#6A4C93). */
export const EXPORT_SELLER_TINTS = ['#0A4FB5', '#0B3D91', '#1B6B93', '#2A9D8F', '#264653', '#40916C'] as const;

function hashName(name: string): number {
  let h = 0;
  const s = name.trim().toLowerCase() || 'store';
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function exportSellerTint(name: string): string {
  return EXPORT_SELLER_TINTS[hashName(name) % EXPORT_SELLER_TINTS.length];
}

/** Two letters from the first two words, or one letter for a single word. */
export function exportSellerMonogram(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'S';
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return parts[0].slice(0, 1).toUpperCase();
}

/** Into: /exports/sellers (viewer market). From: public /exports/{cc}/sellers. */
export function exportSellersListPath(ctx: ExportSellersContext): string {
  return ctx.direction === 'from' && ctx.originCode
    ? `${exportsOriginPath(ctx.originCode)}/sellers`
    : '/exports/sellers';
}

export function exportSellerPath(ctx: ExportSellersContext, locationId: string): string {
  return `${exportSellersListPath(ctx)}/${encodeURIComponent(locationId)}`;
}

/** Indexed URL of the all-sellers list for an origin (always the production host). */
export function exportSellersCanonicalUrl(originCode: string): string {
  return `${EXPORTS_CANONICAL_ORIGIN}${exportsOriginPath(originCode)}/sellers`;
}

/** Indexed URL of one seller page, under the seller's own country. */
export function exportSellerCanonicalUrl(countryCode: string, locationId: string): string {
  return `${exportSellersCanonicalUrl(countryCode)}/${encodeURIComponent(locationId)}`;
}

export function exportSellersQueryParams(
  ctx: ExportSellersContext,
  extra: { limit: number; offset?: number; search?: string; businessLocationId?: string }
): Record<string, string | number> {
  const params: Record<string, string | number> = { export_only: 'true', limit: extra.limit };
  if (extra.offset) params.offset = extra.offset;
  if (ctx.direction === 'from' && ctx.originCode) params.origin_country = ctx.originCode.toUpperCase();
  else if (ctx.marketCode) params.country_code = ctx.marketCode.toUpperCase();
  if (extra.search?.trim()) params.search = extra.search.trim();
  if (extra.businessLocationId) params.business_location_id = extra.businessLocationId;
  return params;
}

type TFn = (key: string, opts: Record<string, unknown>) => string;

/**
 * One-line counts: "71 products · 12 sellers · ships to 7 markets" (From) or
 * "71 products · 12 sellers" (Into). Web i18next v4 plurals (_one / _other).
 */
export function exportsSummaryLine(t: TFn, products: number, sellers: number | null, markets?: number): string {
  const parts = [t('exportSellers.productsCount', { count: products, defaultValue: '{{count}} products' })];
  if (typeof sellers === 'number') {
    parts.push(t('exportSellers.sellersCount', { count: sellers, defaultValue: '{{count}} sellers' }));
  }
  if (typeof markets === 'number') {
    parts.push(
      t(products === 1 ? 'exportSellers.shipsToOneProduct' : 'exportSellers.shipsTo', {
        count: markets,
        defaultValue: 'ships to {{count}} markets',
      })
    );
  }
  return parts.join(' · ');
}

/** Shape returned by GET /stores?export_only=true. The legacy directory is `{ stores }` only. */
export interface ExportSellersEnvelopeData {
  stores?: unknown;
  total?: unknown;
  country?: unknown;
}

export interface ParsedExportSellersPage<T = { country?: string | null }> {
  stores: T[];
  total: number;
  country: string | null;
}

function iso2(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

/**
 * True when this row belongs in the current Exports Into / From context.
 * Into never includes sellers whose location is in the destination market.
 * Rows without a country are treated as untrusted (legacy directory has none).
 */
export function isExportSellerInContext(
  seller: { country?: string | null },
  ctx: ExportSellersContext
): boolean {
  const country = iso2(seller.country);
  if (!country) return false;
  if (ctx.direction === 'into') {
    const market = iso2(ctx.marketCode);
    return !market || country !== market;
  }
  const origin = iso2(ctx.originCode);
  return !origin || country === origin;
}

/**
 * Accept only the export_only envelope ({ stores, total, country }). A legacy
 * local-directory payload ({ stores } and no total) must never appear on the
 * Exports carousel, count line, or See all list.
 *
 * If any row is in the destination country (Into) or outside the origin (From),
 * the whole page is rejected so a mixed or mis-routed response cannot leak.
 */
export function parseExportSellersPage<T extends { country?: string | null }>(
  envelope: { success?: boolean; data?: ExportSellersEnvelopeData } | null | undefined,
  ctx: ExportSellersContext
): ParsedExportSellersPage<T> {
  const empty: ParsedExportSellersPage<T> = { stores: [], total: 0, country: null };
  const data = envelope?.success ? envelope.data : undefined;
  if (!data || typeof data.total !== 'number' || !Number.isFinite(data.total) || data.total < 0) {
    return empty;
  }
  if (!Array.isArray(data.stores)) return empty;
  const stores = data.stores as T[];
  if (stores.some((row) => !isExportSellerInContext(row, ctx))) return empty;
  return {
    stores,
    total: data.total,
    country: iso2(data.country),
  };
}
