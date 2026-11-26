import { isFutureWallClockStart, leadTimeViolation, wallClockNowMs } from './day-hours.rules';
import { classifyRentalEdit } from '../rental-request-edit';

// Request times are listing wall clock written as UTC components: Toronto 12:00 is T12:00:00Z.
const wall = (iso: string) => new Date(`${iso}:00.000Z`);
const TORONTO = 'America/Toronto';
const DOUALA = 'Africa/Douala';
const MANILA = 'Asia/Manila';

describe('isFutureWallClockStart', () => {
  it('accepts Toronto 12:00 at 9:40 AM EST the same day (reported case)', () => {
    const now = Date.parse('2026-11-26T14:40:00.000Z'); // 09:40 EST
    expect(isFutureWallClockStart(wall('2026-11-26T12:00'), now, TORONTO)).toBe(true);
    expect(leadTimeViolation([{ start: wall('2026-11-26T12:00'), end: wall('2026-11-26T16:00'), billing: 'hourly' }], now, TORONTO)).toBeNull();
  });

  it('rejects Toronto 9:30 at 9:40 AM EST (just past)', () => {
    const now = Date.parse('2026-11-26T14:40:00.000Z');
    expect(isFutureWallClockStart(wall('2026-11-26T09:30'), now, TORONTO)).toBe(false);
    expect(isFutureWallClockStart(wall('2026-11-26T09:40'), now, TORONTO)).toBe(false);
    expect(isFutureWallClockStart(wall('2026-11-26T09:45'), now, TORONTO)).toBe(true);
  });

  it('uses EDT in summer and handles the DST switch days in Toronto', () => {
    const july = Date.parse('2026-07-15T13:40:00.000Z'); // 09:40 EDT
    expect(isFutureWallClockStart(wall('2026-07-15T09:45'), july, TORONTO)).toBe(true);
    expect(isFutureWallClockStart(wall('2026-07-15T09:35'), july, TORONTO)).toBe(false);
    // 8 Mar 2026: 02:00 EST -> 03:00 EDT. 10:00 EDT = 14:00Z.
    const spring = Date.parse('2026-03-08T14:00:00.000Z');
    expect(isFutureWallClockStart(wall('2026-03-08T10:05'), spring, TORONTO)).toBe(true);
    expect(isFutureWallClockStart(wall('2026-03-08T09:55'), spring, TORONTO)).toBe(false);
    // 1 Nov 2026: 02:00 EDT -> 01:00 EST. 10:00 EST = 15:00Z.
    const fall = Date.parse('2026-11-01T15:00:00.000Z');
    expect(isFutureWallClockStart(wall('2026-11-01T10:05'), fall, TORONTO)).toBe(true);
    expect(isFutureWallClockStart(wall('2026-11-01T09:55'), fall, TORONTO)).toBe(false);
  });

  it('reads Douala (UTC+1) wall clock', () => {
    const now = Date.parse('2026-11-26T08:40:00.000Z'); // 09:40 WAT
    expect(isFutureWallClockStart(wall('2026-11-26T09:50'), now, DOUALA)).toBe(true);
    // Raw-UTC compare would have let 09:00 through (09:00Z > 08:40Z).
    expect(isFutureWallClockStart(wall('2026-11-26T09:00'), now, DOUALA)).toBe(false);
  });

  it('reads Manila (UTC+8) wall clock', () => {
    const now = Date.parse('2026-11-26T01:40:00.000Z'); // 09:40 PHT
    expect(isFutureWallClockStart(wall('2026-11-26T12:00'), now, MANILA)).toBe(true);
    expect(isFutureWallClockStart(wall('2026-11-26T09:30'), now, MANILA)).toBe(false);
    expect(isFutureWallClockStart(wall('2026-11-26T05:00'), now, MANILA)).toBe(false);
  });

  it('treats an invalid start as not in the future', () => {
    expect(isFutureWallClockStart(new Date('nope'), Date.now(), TORONTO)).toBe(false);
  });
});

describe('classifyRentalEdit with wall-clock now', () => {
  const base = { status: 'pending', version: 1, expectedVersion: 1, unitsFree: true };
  it('keeps a Toronto 12:00 request editable at 9:40 AM and closes it at 10:05 AM', () => {
    const at940 = wallClockNowMs(Date.parse('2026-11-26T14:40:00.000Z'), TORONTO);
    const at1005 = wallClockNowMs(Date.parse('2026-11-26T15:05:00.000Z'), TORONTO);
    const iso = '2026-11-26T12:00:00.000Z';
    expect(classifyRentalEdit({ ...base, currentStartIso: iso, nextStartIso: iso, nowMs: at940 })).toBe('ok');
    expect(classifyRentalEdit({ ...base, currentStartIso: iso, nextStartIso: iso, nowMs: at1005 })).toBe('window_closed');
  });
});
