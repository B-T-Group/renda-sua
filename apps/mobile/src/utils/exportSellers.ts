import { hashStoreName, storeMonogram } from './storeAvatarPalette';

export { storeMonogram as exportSellerMonogram };

/**
 * Monogram tints for sellers without a logo. Brand blue first, then navy / teal / green
 * from the store palette. No purple (#6A4C93 is deliberately left out).
 */
export const EXPORT_SELLER_TINTS = ['#0A4FB5', '#0B3D91', '#1B6B93', '#2A9D8F', '#264653', '#40916C'] as const;

export function exportSellerTint(name: string): string {
  return EXPORT_SELLER_TINTS[hashStoreName(name) % EXPORT_SELLER_TINTS.length];
}

/** Carousel shows at most this many sellers, then a More card when total is larger. */
export const EXPORT_SELLERS_CAROUSEL_MAX = 10;

export interface ExportSellersContext {
  direction: 'into' | 'from';
  marketCode: string | null;
  originCode: string | null;
}

type TFn = (key: string, fallback: string, opts?: Record<string, unknown>) => string;

/**
 * One-line counts: "71 products · 12 sellers · ships to 7 markets" (From) or
 * "71 products · 12 sellers" (Into). Each part is its own v3 plural key.
 */
export function exportsSummaryLine(
  t: TFn,
  products: number,
  sellers: number | null,
  markets?: number
): string {
  const parts = [t('exportSellers.productsCount', '{{count}} products', { count: products })];
  // Sellers still loading: products and markets only (never an unpluralized "1 markets").
  // 0 (rejected or empty directory) must not read as "0 sellers".
  if (typeof sellers === 'number' && sellers > 0) {
    parts.push(t('exportSellers.sellersCount', '{{count}} sellers', { count: sellers }));
  }
  if (typeof markets === 'number') {
    parts.push(
      products === 1
        ? t('exportSellers.shipsToOneProduct', 'ships to {{count}} markets', { count: markets })
        : t('exportSellers.shipsTo', 'ships to {{count}} markets', { count: markets })
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
