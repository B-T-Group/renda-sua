import {
  aggregateExportStoreRows,
  clampExportStoresWindow,
  compareExportStores,
} from './export-stores.util';

describe('export seller directory helpers', () => {
  it('counts distinct export items and keeps the newest listing per location', () => {
    const agg = aggregateExportStoreRows([
      { item_id: 'i1', business_location_id: 'a', created_at: '2026-11-01T00:00:00Z' },
      { item_id: 'i1', business_location_id: 'a', created_at: '2026-11-20T00:00:00Z' },
      { item_id: 'i2', business_location_id: 'a', created_at: '2026-11-10T00:00:00Z' },
      { item_id: 'i3', business_location_id: 'b', created_at: null },
      { item_id: null, business_location_id: 'b' },
      { item_id: 'i4', business_location_id: null },
    ]);
    expect(agg.get('a')).toEqual({ item_count: 2, latest_export_at: '2026-11-20T00:00:00Z' });
    expect(agg.get('b')).toEqual({ item_count: 1, latest_export_at: null });
    expect(agg.size).toBe(2);
  });

  it('orders by export item count, then recency, then name (never distance)', () => {
    const rows = [
      { name: 'Zeta', item_count: 3, latest_export_at: '2026-11-01T00:00:00Z' },
      { name: 'alpha', item_count: 3, latest_export_at: '2026-11-01T00:00:00Z' },
      { name: 'Newer', item_count: 3, latest_export_at: '2026-11-25T00:00:00Z' },
      { name: 'Big', item_count: 14, latest_export_at: null },
      { name: 'Undated', item_count: 3, latest_export_at: null },
    ];
    expect([...rows].sort(compareExportStores).map((r) => r.name)).toEqual([
      'Big',
      'Newer',
      'alpha',
      'Zeta',
      'Undated',
    ]);
  });

  it('clamps limit to 1–50 (default 20) and offset to >= 0', () => {
    expect(clampExportStoresWindow()).toEqual({ limit: 20, offset: 0 });
    expect(clampExportStoresWindow('10', '20')).toEqual({ limit: 10, offset: 20 });
    expect(clampExportStoresWindow('500', '-3')).toEqual({ limit: 50, offset: 0 });
    expect(clampExportStoresWindow('0', 'x')).toEqual({ limit: 1, offset: 0 });
  });
});
