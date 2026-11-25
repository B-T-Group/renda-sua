import { readFileSync } from 'fs';
import { join } from 'path';
import {
  endOfStartDay,
  isNoShow,
  isStartDay,
  reservedUnpaidDue,
  startOpensAt,
  startWindowState,
} from './simple-start.policy';

const TORONTO = 'America/Toronto';
const DOUALA = 'Africa/Douala';

describe('rental start window', () => {
  it('opens at local midnight and closes at end_at for Toronto and Douala', () => {
    const torontoStart = new Date('2026-11-24T15:00:00.000Z');
    expect(startOpensAt(torontoStart, TORONTO).toISOString()).toBe('2026-11-24T05:00:00.000Z');
    expect(endOfStartDay(torontoStart, TORONTO).toISOString()).toBe('2026-11-25T05:00:00.000Z');

    const doualaStart = new Date('2026-11-24T08:00:00.000Z');
    expect(startOpensAt(doualaStart, DOUALA).toISOString()).toBe('2026-11-23T23:00:00.000Z');
    expect(endOfStartDay(doualaStart, DOUALA).toISOString()).toBe('2026-11-24T23:00:00.000Z');
  });

  it('treats the instant before local midnight as not yet the pickup day', () => {
    const start = new Date('2026-11-24T15:00:00.000Z');
    const justBefore = new Date('2026-11-24T04:59:59.999Z');
    expect(startWindowState({ now: justBefore, startAt: start, endAt: new Date('2026-11-26T15:00:00.000Z'), timeZone: TORONTO })).toBe('before');
    expect(startWindowState({ now: new Date('2026-11-24T05:00:00.000Z'), startAt: start, endAt: new Date('2026-11-26T15:00:00.000Z'), timeZone: TORONTO })).toBe('open');
  });

  it('allows the opening instant and refuses the end instant', () => {
    const start = new Date('2026-11-24T08:00:00.000Z');
    const end = new Date('2026-11-25T08:00:00.000Z');
    const opens = startOpensAt(start, DOUALA);
    expect(startWindowState({ now: opens, startAt: start, endAt: end, timeZone: DOUALA })).toBe('open');
    expect(startWindowState({ now: end, startAt: start, endAt: end, timeZone: DOUALA })).toBe('after');
  });

  it('skips a missing date instead of closing the window', () => {
    expect(startWindowState({
      now: new Date('2026-11-24T12:00:00.000Z'),
      startAt: new Date(NaN),
      endAt: new Date(NaN),
      timeZone: DOUALA,
    })).toBe('unknown');
  });
});

describe('unpaid Mobile Money cutoff and no-show', () => {
  const start = new Date('2026-11-24T08:00:00.000Z');

  it('cancels an unpaid reservation at the end of the start day, not 60 minutes after start', () => {
    const during = new Date('2026-11-24T10:00:00.000Z');
    expect(reservedUnpaidDue({
      now: during,
      startAt: start,
      timeZone: DOUALA,
      policyVersion: null,
      pickupInspectionPending: false,
    })).toBe(false);
    expect(reservedUnpaidDue({
      now: new Date('2026-11-24T23:00:00.000Z'),
      startAt: start,
      timeZone: DOUALA,
      policyVersion: null,
      pickupInspectionPending: false,
    })).toBe(true);
  });

  it('pauses the unpaid cancel while pickup photos are still pending', () => {
    expect(reservedUnpaidDue({
      now: new Date('2026-11-25T00:00:00.000Z'),
      startAt: start,
      timeZone: DOUALA,
      policyVersion: 1,
      pickupInspectionPending: true,
    })).toBe(false);
  });

  it('marks a confirmed booking with no start as a no-show at end_at', () => {
    const end = new Date('2026-11-25T08:00:00.000Z');
    expect(isNoShow({ status: 'confirmed', actualStartAt: null, endAt: end, now: end })).toBe(true);
    expect(isNoShow({
      status: 'confirmed',
      actualStartAt: null,
      endAt: end,
      now: new Date(end.getTime() - 1),
    })).toBe(false);
    expect(isNoShow({
      status: 'confirmed',
      actualStartAt: '2026-11-24T12:00:00.000Z',
      endAt: end,
      now: end,
    })).toBe(false);
  });

  it('matches the pickup calendar day in the listing zone', () => {
    const now = new Date('2026-11-24T04:30:00.000Z');
    expect(isStartDay(start, now, TORONTO)).toBe(false);
    expect(isStartDay(start, now, DOUALA)).toBe(true);
  });
});

describe('rental_mark_started window', () => {
  it('rejects a start outside the listing day and sets the unpaid deadline to the end of that day', () => {
    const sql = readFileSync(
      join(__dirname, '../../../../hasura/migrations/Rendasua/20261123120000_rental_simple_start/up.sql'),
      'utf8'
    );
    expect(sql).toContain("RAISE EXCEPTION 'rental_start_window'");
    expect(sql).toContain('p_at < v_opens OR p_at >= v_booking.end_at');
    expect(sql).toContain('public.rental_end_of_start_day(start_at, v_country)');
    expect(sql).not.toContain('rentals_simple_start_enabled');
    expect(sql).not.toContain('application_configurations');
  });
});
