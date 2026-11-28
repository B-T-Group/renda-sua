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
  if (typeof sellers === 'number') {
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
