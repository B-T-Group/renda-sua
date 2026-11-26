import { readFileSync } from 'fs';
import { join } from 'path';
import {
  bookingReturnDueAt,
  bookingReturnDueInstantMs,
  earlyStartReturnDue,
  isSingleHourlyBooking,
} from './return-due';

const TORONTO = 'America/Toronto';
const DOUALA = 'Africa/Douala';
const MANILA = 'Asia/Manila';
const HOURLY = { version: 4, lines: [{ kind: 'hourly' }] };
const at = (iso: string) => new Date(iso);

/** 14:00-16:00 on the listing clock, stored as UTC components. */
function due(actualStartAt: string, timeZone: string, overrides: Record<string, unknown> = {}) {
  return earlyStartReturnDue({
    startAt: '2026-11-26T14:00:00.000Z',
    endAt: '2026-11-26T16:00:00.000Z',
    snapshot: HOURLY,
    actualStartAt: at(actualStartAt),
    timeZone,
    ...overrides,
  });
}

describe('hourly early start return due', () => {
  it('Toronto: 2 PM-4 PM started at 11 AM is due at 1 PM', () => {
    expect(due('2026-11-26T16:00:00.000Z', TORONTO)).toBe('2026-11-26T13:00:00.000Z');
  });

  it('Douala: 14:00-16:00 started at 11:00 is due at 13:00', () => {
    expect(due('2026-11-26T10:00:00.000Z', DOUALA)).toBe('2026-11-26T13:00:00.000Z');
  });

  it('Manila: 14:00-16:00 started at 11:00 is due at 13:00', () => {
    expect(due('2026-11-26T03:00:00.000Z', MANILA)).toBe('2026-11-26T13:00:00.000Z');
  });

  it('keeps minutes: started at 11:07 is due at 13:07', () => {
    expect(due('2026-11-26T16:07:00.000Z', TORONTO)).toBe('2026-11-26T13:07:00.000Z');
  });

  it('on-time and late starts keep the booked end (late start is an open question)', () => {
    expect(due('2026-11-26T19:00:00.000Z', TORONTO)).toBeNull();
    expect(due('2026-11-26T19:30:00.000Z', TORONTO)).toBeNull();
    expect(due('2026-11-26T13:00:00.000Z', DOUALA)).toBeNull();
  });

  it('full-day, multi-window and old snapshots keep the booked end', () => {
    expect(due('2026-11-26T10:00:00.000Z', DOUALA, { snapshot: { lines: [{ kind: 'all_day' }] } })).toBeNull();
    expect(
      due('2026-11-26T10:00:00.000Z', DOUALA, { snapshot: { lines: [{ kind: 'hourly' }, { kind: 'hourly' }] } })
    ).toBeNull();
    expect(due('2026-11-26T10:00:00.000Z', DOUALA, { snapshot: { version: 2, ratePerHour: 500 } })).toBeNull();
    expect(due('2026-11-26T10:00:00.000Z', DOUALA, { snapshot: null })).toBeNull();
    expect(isSingleHourlyBooking(HOURLY)).toBe(true);
  });

  it('DST fall back (Toronto 1 Nov): 03:00-05:00 started 00:30 EDT gets 2 real hours, due 01:30 EST', () => {
    const value = due('2026-11-01T04:30:00.000Z', TORONTO, {
      startAt: '2026-11-01T03:00:00.000Z',
      endAt: '2026-11-01T05:00:00.000Z',
    });
    expect(value).toBe('2026-11-01T01:30:00.000Z');
    expect(bookingReturnDueInstantMs({ return_due_at: value }, TORONTO) - Date.parse('2026-11-01T04:30:00.000Z')).toBe(
      2 * 3_600_000
    );
  });

  it('DST spring forward (Toronto 8 Mar): 03:00-05:00 started 01:30 EST is due 04:30 EDT', () => {
    const value = due('2026-03-08T06:30:00.000Z', TORONTO, {
      startAt: '2026-03-08T03:00:00.000Z',
      endAt: '2026-03-08T05:00:00.000Z',
    });
    expect(value).toBe('2026-03-08T04:30:00.000Z');
    expect(bookingReturnDueInstantMs({ return_due_at: value }, TORONTO)).toBe(Date.parse('2026-03-08T08:30:00.000Z'));
  });

  it('reads return_due_at first, then end_at, as a real instant on the listing clock', () => {
    const booking = {
      end_at: '2026-11-26T16:00:00.000Z',
      return_due_at: '2026-11-26T13:00:00.000Z',
      rental_location_listing: { business_location: { address: { country: 'Canada' } } },
    };
    expect(bookingReturnDueAt(booking)).toBe('2026-11-26T13:00:00.000Z');
    expect(new Date(bookingReturnDueInstantMs(booking)).toISOString()).toBe('2026-11-26T18:00:00.000Z');
    expect(bookingReturnDueAt({ ...booking, return_due_at: null })).toBe('2026-11-26T16:00:00.000Z');
    expect(Number.isNaN(bookingReturnDueInstantMs({}))).toBe(true);
  });
});

describe('rental_early_start_return_due migration', () => {
  const sql = readFileSync(
    join(__dirname, '../../../hasura/migrations/Rendasua/20261126213000_rental_early_start_return_due/up.sql'),
    'utf8'
  );

  it('stamps return_due_at in rental_mark_started and keeps its signature', () => {
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS return_due_at timestamptz');
    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION public.rental_mark_started(p_booking_id uuid, p_at timestamptz)'
    );
    expect(sql).toContain('return_due_at = public.rental_early_start_return_due(');
    expect(sql).toContain('actual_start_at = p_at');
    expect(sql).toContain("RAISE EXCEPTION 'rental_start_window'");
    expect(sql).not.toContain('application_configurations');
  });
});
