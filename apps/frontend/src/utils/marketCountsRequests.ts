/**
 * Exports INTO a market, counted with the existing list endpoint (no dedicated route):
 * GET /inventory-items?export_only=true&limit=1&country_code=XX → data.total.
 * The query is part of the URL (not axios params) so the API client can recognise this
 * background request and skip the full-screen loading overlay.
 */
export const MARKET_EXPORTS_COUNT_URL_PREFIX =
  '/inventory-items?export_only=true&limit=1&country_code=';

export function marketExportsCountUrl(countryCode: string): string {
  return `${MARKET_EXPORTS_COUNT_URL_PREFIX}${encodeURIComponent(countryCode)}`;
}
