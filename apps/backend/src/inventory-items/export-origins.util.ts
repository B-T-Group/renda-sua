/** One row of the Exports "From" origin picker. */
export interface ExportOriginSummary {
  /** ISO-2 country of the exporting businesses' home listings. */
  country_code: string;
  /** Distinct catalog items exported from this country. */
  item_count: number;
  /** Distinct businesses exporting from this country. */
  business_count: number;
  /** Distinct destination markets (ISO-2), sorted. */
  destination_codes: string[];
}

/** Returns an upper-case ISO-2 code, or undefined when the input is not two letters. */
export function normalizeExportOriginCountry(raw?: string | null): string | undefined {
  const code = raw?.trim().toUpperCase();
  return code && /^[A-Z]{2}$/.test(code) ? code : undefined;
}

interface ExportOriginRow {
  item_id?: string | null;
  business_location?: {
    business_id?: string | null;
    address?: { country?: string | null } | null;
  } | null;
  item?: { export_markets?: Array<{ country_code?: string | null }> | null } | null;
}

/** Groups export inventory rows by home country; most items first, then by code. */
export function summarizeExportOrigins(rows: ExportOriginRow[]): ExportOriginSummary[] {
  const byCountry = new Map<
    string,
    { items: Set<string>; businesses: Set<string>; destinations: Set<string> }
  >();
  for (const row of rows) {
    const country = normalizeExportOriginCountry(row?.business_location?.address?.country);
    const itemId = row?.item_id;
    if (!country || !itemId) continue;
    const acc = byCountry.get(country) ?? {
      items: new Set<string>(),
      businesses: new Set<string>(),
      destinations: new Set<string>(),
    };
    acc.items.add(String(itemId));
    const businessId = row.business_location?.business_id;
    if (businessId) acc.businesses.add(String(businessId));
    for (const market of row.item?.export_markets ?? []) {
      const code = normalizeExportOriginCountry(market?.country_code);
      if (code) acc.destinations.add(code);
    }
    byCountry.set(country, acc);
  }
  return [...byCountry.entries()]
    .map(([country_code, acc]) => ({
      country_code,
      item_count: acc.items.size,
      business_count: acc.businesses.size,
      destination_codes: [...acc.destinations].sort(),
    }))
    .sort((a, b) => b.item_count - a.item_count || a.country_code.localeCompare(b.country_code));
}
