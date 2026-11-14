import { describe, expect, it } from 'vitest';
import { blockedGuideRows, blockedScreenRows, checklistCount, groupBlockedRows, otherReasonReady, submitLeftCount, undoSkip } from './blockedGuideRows';
import { formatListingStamp, slotTileLabel } from './pickupPhotoTime';

describe('blocked guide rows', () => {
  it('lists every missing slot and uses that list for the count', () => {
    const gaps = [3, 4, 5, 6, 7, 8, 9].map((n) => ({
      unitId: 'unit-1',
      slotKey: `extra:${n}`,
      required: false,
    }));
    const slots = gaps.map((gap) => ({ slotKey: gap.slotKey, url: `https://signed.example/${gap.slotKey}` }));
    const rows = blockedGuideRows(gaps, slots);
    expect(rows).toHaveLength(gaps.length);
    expect(rows.map((row) => row.slotKey)).toEqual(gaps.map((gap) => gap.slotKey));
    expect(rows.every((row) => row.action === 'skip' && row.thumbUrl)).toBe(true);
    const required = blockedGuideRows(
      [
        { unitId: 'unit-1', slotKey: 'overview', required: true },
        { unitId: 'unit-1', slotKey: 'extra:1', required: false },
      ],
      [{ slotKey: 'overview', url: 'https://signed.example/overview' }]
    );
    expect(required.map((row) => row.action)).toEqual(['retake', 'skip']);
    expect(required[1].thumbUrl).toBeNull();
  });

  it('keeps the submit count on the open gaps when a skipped row is still listed', () => {
    const gaps = [3, 4, 5, 6, 7, 8].map((n) => ({ unitId: 'unit-1', slotKey: `extra:${n}`, required: false }));
    const slots = gaps.map((gap) => ({ slotKey: gap.slotKey, url: 'https://signed.example/g' }));
    const rows = blockedScreenRows(gaps, [{ unitId: 'unit-1', slotKey: 'extra:9', reason: 'Not on this unit' }], slots);
    expect(submitLeftCount(gaps)).toBe(6);
    expect(rows).toHaveLength(7);
    expect(rows[6].reason).toBe('Not on this unit');
    expect(checklistCount(rows.filter((row) => !row.reason))).toBe(submitLeftCount(gaps));
  });

  it('undoes a skip and keeps Other empty until there is text', () => {
    const skips = [{ unitId: 'unit-1', slotKey: 'extra:9', reason: 'Not on this unit' }];
    const left = undoSkip(skips, { unitId: 'unit-1', slotKey: 'extra:9' });
    expect(left).toEqual([]);
    expect(groupBlockedRows(blockedScreenRows([], left, [])).skipped).toEqual([]);
    expect(otherReasonReady('')).toBe(false);
    expect(otherReasonReady('   ')).toBe(false);
    expect(otherReasonReady('Handle is missing')).toBe(true);
    expect(otherReasonReady('x'.repeat(280))).toBe(true);
    expect(otherReasonReady('x'.repeat(281))).toBe(false);
    expect(slotTileLabel('extra:3', 'fr')).toBe('Supp. 3');
    expect(slotTileLabel('overview', 'en')).toBe('Overview');
  });

  it('formats a French listing stamp as 17 nov. · 10:14', () => {
    expect(formatListingStamp('2026-11-17T15:14:00.000Z', 'America/Toronto', 'fr')).toBe('17 nov. · 10:14');
    expect(formatListingStamp('2026-11-17T15:14:00.000Z', 'America/Toronto', 'en')).toBe('17 Nov · 10:14');
  });
});
