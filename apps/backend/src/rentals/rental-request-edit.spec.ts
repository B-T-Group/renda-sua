import { readFileSync } from 'fs';
import { join } from 'path';
import {
  buildChangeSummary,
  classifyRentalAccept,
  classifyRentalEdit,
  editWindowOpen,
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
});
