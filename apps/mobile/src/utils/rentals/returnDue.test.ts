import {
  bookingReturnDue,
  earlyReturnLine,
  earlyReturnPreview,
  formatReturnClock,
  formatReturnDuration,
} from './returnDue';

const HOURLY = { lines: [{ kind: 'hourly' }] };
const booking = {
  start_at: '2026-11-26T14:00:00.000Z',
  end_at: '2026-11-26T16:00:00.000Z',
  rental_pricing_snapshot: HOURLY,
};
const t = (_key: string, fallback: string, vars: Record<string, string> = {}) =>
  fallback.replace(/{{(\w+)}}/g, (_m, name: string) => vars[name] ?? '');

describe('hourly early start return preview', () => {
  it('Toronto 2-4 PM opened at 11 AM is due at 1 PM, 2 h from now', () => {
    const preview = earlyReturnPreview(booking, Date.parse('2026-11-26T16:00:00.000Z'), 'America/Toronto');
    expect(preview).toEqual({ dueAt: '2026-11-26T13:00:00.000Z', durationMs: 2 * 3_600_000 });
    if (!preview) throw new Error('expected a preview');
    expect(earlyReturnLine(preview, 'en', t)).toBe('Return by 1:00 PM (2 h from now)');
    const fr = (_k: string, _f: string, vars: Record<string, string> = {}) => `Retour avant ${vars.time} (dans ${vars.duration})`;
    expect(earlyReturnLine(preview, 'fr', fr)).toBe('Retour avant 13:00 (dans 2 h)');
  });

  it('Douala and Manila 11:00 starts are due at 13:00', () => {
    expect(earlyReturnPreview(booking, Date.parse('2026-11-26T10:00:00.000Z'), 'Africa/Douala')?.dueAt).toBe(
      '2026-11-26T13:00:00.000Z'
    );
    expect(earlyReturnPreview(booking, Date.parse('2026-11-26T03:00:00.000Z'), 'Asia/Manila')?.dueAt).toBe(
      '2026-11-26T13:00:00.000Z'
    );
  });

  it('on time, late, full-day and multi-window keep the existing line', () => {
    expect(earlyReturnPreview(booking, Date.parse('2026-11-26T19:00:00.000Z'), 'America/Toronto')).toBeNull();
    expect(earlyReturnPreview(booking, Date.parse('2026-11-26T19:20:00.000Z'), 'America/Toronto')).toBeNull();
    const day = { ...booking, rental_pricing_snapshot: { lines: [{ kind: 'all_day' }] } };
    expect(earlyReturnPreview(day, Date.parse('2026-11-26T10:00:00.000Z'), 'Africa/Douala')).toBeNull();
    const two = { ...booking, rental_pricing_snapshot: { lines: [{ kind: 'hourly' }, { kind: 'hourly' }] } };
    expect(earlyReturnPreview(two, Date.parse('2026-11-26T10:00:00.000Z'), 'Africa/Douala')).toBeNull();
  });

  it('DST fall back keeps 2 real hours (Toronto 1 Nov, 00:30 EDT start is due 01:30 EST)', () => {
    const dst = { ...booking, start_at: '2026-11-01T03:00:00.000Z', end_at: '2026-11-01T05:00:00.000Z' };
    expect(earlyReturnPreview(dst, Date.parse('2026-11-01T04:30:00.000Z'), 'America/Toronto')?.dueAt).toBe(
      '2026-11-01T01:30:00.000Z'
    );
  });

  it('formats clock and duration', () => {
    expect(formatReturnClock('2026-11-26T00:05:00.000Z', 'en')).toBe('12:05 AM');
    expect(formatReturnClock('2026-11-26T09:30:00.000Z', 'fr')).toBe('09:30');
    expect(formatReturnDuration(90 * 60_000)).toBe('1 h 30 min');
    expect(formatReturnDuration(45 * 60_000)).toBe('45 min');
  });

  it('reads return_due_at before end_at', () => {
    expect(bookingReturnDue({ ...booking, return_due_at: '2026-11-26T13:00:00.000Z' })).toBe('2026-11-26T13:00:00.000Z');
    expect(bookingReturnDue(booking)).toBe('2026-11-26T16:00:00.000Z');
  });
});
