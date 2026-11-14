import { readFileSync } from 'fs';
import { join } from 'path';
import {
  buildChangeSummary,
  classifyRentalAccept,
  classifyRentalEdit,
  earliestWindowIso,
  editWindowOpen,
  quotePlanTotal,
  RENTAL_EDIT_LEAD_MS,
} from './rental-request-edit';

const NOW = Date.parse('2026-11-11T10:00:00.000Z');
const OPEN = new Date(NOW + RENTAL_EDIT_LEAD_MS + 60_000).toISOString();
const CLOSED = new Date(NOW + RENTAL_EDIT_LEAD_MS - 60_000).toISOString();

describe('rental request edit rules', () => {
  it('keeps the edit window open only more than 2 hours before start', () => {
    expect(editWindowOpen(OPEN, NOW)).toBe(true);
    expect(editWindowOpen(CLOSED, NOW)).toBe(false);
    expect(editWindowOpen(new Date(NOW + RENTAL_EDIT_LEAD_MS).toISOString(), NOW)).toBe(false);
    expect(editWindowOpen(new Date(NOW + RENTAL_EDIT_LEAD_MS + 1).toISOString(), NOW)).toBe(true);
    expect(editWindowOpen('not-a-date', NOW)).toBe(false);
    expect(editWindowOpen(earliestWindowIso([]), NOW)).toBe(false);
  });

  it('blocks a save that is no longer pending, stale, inside 2h, or over capacity', () => {
    const base = {
      status: 'pending',
      version: 2,
      expectedVersion: 2,
      currentStartIso: OPEN,
      nextStartIso: OPEN,
      nowMs: NOW,
      unitsFree: true,
    };
    expect(classifyRentalEdit(base)).toBe('ok');
    expect(classifyRentalEdit({ ...base, status: 'available' })).toBe('not_pending');
    expect(classifyRentalEdit({ ...base, expectedVersion: 1 })).toBe('stale_version');
    expect(classifyRentalEdit({ ...base, currentStartIso: CLOSED })).toBe('window_closed');
    expect(classifyRentalEdit({ ...base, nextStartIso: CLOSED })).toBe('window_closed');
    expect(classifyRentalEdit({ ...base, unitsFree: false })).toBe('unavailable');
  });

  it('rejects an accept for a version the business did not send', () => {
    expect(
      classifyRentalAccept({ status: 'pending', version: 3, expectedVersion: 2, requireVersion: true })
    ).toBe('stale_version');
    expect(
      classifyRentalAccept({ status: 'pending', version: 3, expectedVersion: null, requireVersion: true })
    ).toBe('missing_version');
    expect(
      classifyRentalAccept({ status: 'available', version: 3, expectedVersion: 3, requireVersion: true })
    ).toBe('not_pending');
    expect(
      classifyRentalAccept({ status: 'pending', version: 1, expectedVersion: null, requireVersion: false })
    ).toBe('ok');
    expect(
      classifyRentalAccept({ status: 'available', version: 2, expectedVersion: null, requireVersion: true })
    ).toBe('missing_version');
    expect(
      classifyRentalAccept({ status: 'available', version: 2, expectedVersion: 1, requireVersion: false })
    ).toBe('not_pending');
    expect(
      classifyRentalAccept({ status: 'pending', version: 4, expectedVersion: 4, requireVersion: true })
    ).toBe('ok');
  });

  it('lists only the fields that changed', () => {
    const window = { billing: 'all_day', calendar_date: '2026-11-15', start_at: 'a', end_at: 'b' };
    const next = { ...window, calendar_date: '2026-11-16' };
    const summary = buildChangeSummary(
      { windows: [window], units: 1, note: 'Bastos' },
      { windows: [next], units: 1, note: 'Bastos' }
    );
    expect(summary.fields).toEqual(['dates']);
    expect(summary.quantity).toBeUndefined();
    expect(summary.notes).toBeUndefined();
  });

  it('ignores window order, hourly billing labels, and whitespace-only notes', () => {
    const hourly = { billing: 'hourly', start_at: 's', end_at: 'e' };
    const day = { billing: 'all_day', calendar_date: '2026-12-15', start_at: 's2', end_at: 'e2' };
    const reordered = buildChangeSummary(
      { windows: [hourly, day], units: 1, note: '  Keep  ' },
      { windows: [day, { start_at: 's', end_at: 'e' }], units: 1, note: 'Keep' }
    );
    expect(reordered.fields).toEqual([]);

    const quantity = buildChangeSummary(
      { windows: [hourly], units: 1, note: '   ' },
      { windows: [hourly], units: 3, note: null }
    );
    expect(quantity.fields).toEqual(['quantity']);
    expect(quantity.quantity).toEqual({ from: 1, to: 3 });
    expect(quantity.notes).toBeUndefined();

    const switched = buildChangeSummary(
      { windows: [hourly], units: 1, note: null },
      { windows: [{ ...hourly, billing: 'all_day', calendar_date: '2026-12-15' }], units: 1, note: 'Site' }
    );
    expect(switched.fields).toEqual(['dates', 'notes']);
    expect(switched.notes).toEqual({ changed: true });
  });

  it('uses the earliest real start and an empty string when every start is unusable', () => {
    expect(
      earliestWindowIso([
        { start_at: 'not-a-date', end_at: 'x' },
        { start_at: '2026-12-16T00:00:00.000Z', end_at: 'x' },
        { start_at: '2026-12-15T08:00:00.000Z', end_at: 'x' },
      ])
    ).toBe('2026-12-15T08:00:00.000Z');
    expect(earliestWindowIso([{ start_at: 'nope', end_at: 'x' }])).toBe('');
  });
});

describe('quotePlanTotal', () => {
  const start = new Date('2026-12-15T10:00:00.000Z');
  const plus = (ms: number) => new Date(start.getTime() + ms);

  it('bills each all-day window at the day rate and each partial hour as one hour', () => {
    expect(
      quotePlanTotal(
        [
          { billing: 'all_day', start, end: plus(30 * 60 * 1000) },
          { billing: 'hourly', start, end: plus(30 * 60 * 1000) },
        ],
        380,
        16,
        2
      )
    ).toBe(792);
    expect(quotePlanTotal([{ billing: 'hourly', start, end: plus(60 * 60 * 1000 + 1) }], 380, 10.25, 1)).toBe(
      20.5
    );
    expect(quotePlanTotal([{ billing: 'hourly', start, end: plus(-60 * 1000) }], 380, 10, 1)).toBe(10);
  });

  it('returns null only when both rates are unusable and treats one missing rate as zero', () => {
    expect(quotePlanTotal([{ billing: 'hourly', start, end: plus(30 * 60 * 1000) }], Number.NaN, Number.NaN, 1)).toBe(
      null
    );
    expect(quotePlanTotal([{ billing: 'all_day', start, end: plus(0) }], Number.NaN, 16, 2)).toBe(0);
    expect(quotePlanTotal([{ billing: 'hourly', start, end: plus(30 * 60 * 1000) }], 380, Number.NaN, 2)).toBe(0);
    expect(quotePlanTotal([], 380, 16, 2)).toBe(0);
  });
});

describe('apply_rental_request_edit SQL', () => {
  const sql = readFileSync(
    join(__dirname, '../../../hasura/migrations/Rendasua/20261111120000_rental_request_edits/up.sql'),
    'utf8'
  );

  it('locks the listing and the request, then compare-and-sets the version', () => {
    expect(sql).toContain('FOR NO KEY UPDATE');
    expect(sql).toContain('FOR UPDATE');
    expect(sql).toContain('edit_version = p_expected_version');
    expect(sql).toContain("status::text IS DISTINCT FROM 'pending'");
    expect(sql).toContain("interval '2 hours'");
  });

  it('uses the create hold set and skips other pending requests', () => {
    const fn = sql.slice(
      sql.indexOf('FUNCTION public.rental_peak_units_held_except'),
      sql.indexOf('FUNCTION public.apply_rental_request_edit')
    );
    expect(fn).toContain("b.status::text IN ('reserved', 'confirmed', 'active', 'awaiting_return')");
    expect(fn).toContain("b.status::text = 'proposed' AND b.contract_expires_at > p_now");
    expect(fn).toContain('b.rental_request_id IS DISTINCT FROM p_exclude_request_id');
    expect(fn).not.toContain('rental_requests');
    expect(fn).not.toContain("status = 'pending'");
  });

  it('prices an all-day edit on the calendar day, floors an hour, and trims the note', () => {
    const fn = sql.slice(sql.indexOf('FUNCTION public.apply_rental_request_edit'));
    expect(fn).toContain("(v_elem->>'calendar_date' || 'T00:00:00Z')::timestamptz");
    expect(fn).toContain("v_start + interval '1 day'");
    expect(fn).toContain('GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_end - v_start)) / 3600.0))');
    expect(fn).toContain("NULLIF(btrim(COALESCE(p_note, '')), '')");
    expect(fn).toContain('p_units < 1');
    expect(fn).toContain('ROUND(v_total, 2)');
    expect(fn).toContain('edit_version = p_expected_version');
  });
});
