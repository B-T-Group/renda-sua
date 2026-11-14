import { blockedGuideRows } from './blockedGuideRows';

describe('blocked guide rows', () => {
  it('lists every missing slot and uses that list for the count', () => {
    const gaps = [3, 4, 5, 6, 7, 8, 9].map((n) => ({
      unitId: 'unit-1',
      slotKey: `extra:${n}`,
      required: false,
    }));
    const rows = blockedGuideRows(
      gaps,
      gaps.map((gap) => ({ slotKey: gap.slotKey, url: `https://signed.example/${gap.slotKey}` }))
    );
    expect(rows).toHaveLength(gaps.length);
    expect(rows.map((row) => row.slotKey)).toEqual(gaps.map((gap) => gap.slotKey));
    expect(rows.every((row) => row.action === 'skip' && row.thumbUrl)).toBe(true);
  });
});