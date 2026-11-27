import {
  normalizeExportOriginCountry,
  summarizeExportOrigins,
} from './export-origins.util';

describe('normalizeExportOriginCountry', () => {
  it('upper-cases two-letter codes and rejects anything else', () => {
    expect(normalizeExportOriginCountry(' ca ')).toBe('CA');
    expect(normalizeExportOriginCountry('CAN')).toBeUndefined();
    expect(normalizeExportOriginCountry('')).toBeUndefined();
    expect(normalizeExportOriginCountry(null)).toBeUndefined();
    expect(normalizeExportOriginCountry('c1')).toBeUndefined();
  });
});

describe('summarizeExportOrigins', () => {
  it('counts distinct items and businesses per origin, most items first', () => {
    const rows = [
      // Same item listed twice counts once.
      { item_id: 'i1', business_location: { business_id: 'b1', address: { country: 'CA' } }, item: { export_markets: [{ country_code: 'CM' }] } },
      { item_id: 'i1', business_location: { business_id: 'b1', address: { country: 'CA' } }, item: { export_markets: [{ country_code: 'CM' }] } },
      { item_id: 'i2', business_location: { business_id: 'b9', address: { country: 'GA' } }, item: { export_markets: [{ country_code: 'cm' }] } },
      { item_id: 'i3', business_location: { business_id: 'b8', address: { country: 'TG' } }, item: { export_markets: [] } },
      { item_id: 'i4', business_location: { business_id: 'b8', address: { country: 'TG' } }, item: null },
      // Rows without a usable country are skipped.
      { item_id: 'i5', business_location: { business_id: 'b7', address: null }, item: null },
    ];
    expect(summarizeExportOrigins(rows)).toEqual([
      { country_code: 'TG', item_count: 2, business_count: 1, destination_codes: [] },
      { country_code: 'CA', item_count: 1, business_count: 1, destination_codes: ['CM'] },
      { country_code: 'GA', item_count: 1, business_count: 1, destination_codes: ['CM'] },
    ]);
  });

  it('returns an empty list for no rows', () => {
    expect(summarizeExportOrigins([])).toEqual([]);
  });
});
