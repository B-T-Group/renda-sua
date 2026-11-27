/**
 * Viewer rules for export-only items (exports by origin, AC6–AC8).
 * An export item is never bought in the app, in any market (origin included).
 * "I’m interested" shows only when the viewer market is one of the item's destinations.
 */
export type ExportViewerRole = 'destination' | 'origin' | 'third';

export interface ExportItemLike {
  item?: {
    export_available?: boolean | null;
    export_markets?: Array<{ country_code?: string | null }> | null;
  } | null;
  business_location?: {
    address?: { country?: string | null } | null;
  } | null;
}

export function isExportOnlyItem(row: ExportItemLike | null | undefined): boolean {
  return row?.item?.export_available === true;
}

/** Destination markets, upper-case, unique, sorted. */
export function exportDestinationCodes(row: ExportItemLike | null | undefined): string[] {
  const set = new Set<string>();
  for (const m of row?.item?.export_markets ?? []) {
    const code = m?.country_code?.trim().toUpperCase();
    if (code && /^[A-Z]{2}$/.test(code)) set.add(code);
  }
  return [...set].sort();
}

/** Home country of the listing (business location address). */
export function exportOriginCode(row: ExportItemLike | null | undefined): string | null {
  const code = row?.business_location?.address?.country?.trim().toUpperCase();
  return code && /^[A-Z]{2}$/.test(code) ? code : null;
}

/** Destination wins when a market is both (rare); unknown market counts as third. */
export function exportViewerRole(
  row: ExportItemLike | null | undefined,
  marketCode: string | null | undefined
): ExportViewerRole {
  const market = marketCode?.trim().toUpperCase();
  if (market && exportDestinationCodes(row).includes(market)) return 'destination';
  if (market && exportOriginCode(row) === market) return 'origin';
  return 'third';
}

/** "CM · GA · CI +2" (first `max` codes, then a count). */
export function formatExportDestinations(codes: string[], max = 3): string {
  if (codes.length <= max) return codes.join(' · ');
  return `${codes.slice(0, max).join(' · ')} +${codes.length - max}`;
}

/** Cart lines whose item is export only (the cart is client-side; purge them). */
export function partitionExportCartLines<T>(
  lines: T[],
  isExport: (line: T) => boolean
): { keep: T[]; removed: T[] } {
  const keep: T[] = [];
  const removed: T[] = [];
  for (const line of lines) (isExport(line) ? removed : keep).push(line);
  return { keep, removed };
}
