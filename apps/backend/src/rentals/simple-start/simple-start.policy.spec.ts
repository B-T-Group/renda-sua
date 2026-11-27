import { readFileSync } from 'fs';
import { join } from 'path';
import {
  endOfStartDay,
  endOfStartDayInstant,
  isNoShow,
  isStartDay,
  reservedUnpaidDue,
  startOpensAt,
  startWindowState,
  wallClockReached,
} from './simple-start.policy';

/**
 * start_at / end_at are the listing's wall clock written as UTC components
 * (Toronto 12:00 is ...T12:00:00Z). `now` is always a real instant here, so every
 * expectation below is phrased in real UTC instants for that listing.
 */
const TORONTO = 'America/Toronto';
const DOUALA = 'Africa/Douala';
const MANILA = 'Asia/Manila';
const at = (iso: string) => new Date(iso);

describe('rental start window', () => {
  it('keeps the opening and the end of the start day on the stored date (wall clock)', () => {
    const torontoStart = at('2026-11-24T15:00:00.000Z');
    expect(startOpensAt(torontoStart, TORONTO).toISOString()).toBe('2026-11-24T00:00:00.000Z');
    expect(endOfStartDay(torontoStart, TORONTO).toISOString()).toBe('2026-11-25T00:00:00.000Z');

    const doualaStart = at('2026-11-24T08:00:00.000Z');
    expect(startOpensAt(doualaStart, DOUALA).toISOString()).toBe('2026-11-24T00:00:00.000Z');
    expect(endOfStartDay(doualaStart, DOUALA).toISOString()).toBe('2026-11-25T00:00:00.000Z');
  });

  it('opens a Toronto pickup at Toronto midnight, not 7 PM the evening before', () => {
    const start = at('2026-11-26T12:00:00.000Z');
    const end = at('2026-11-26T16:00:00.000Z');
    const state = (now: string) => startWindowState({ now: at(now), startAt: start, endAt: end, timeZone: TORONTO });
    expect(state('2026-11-26T00:00:00.000Z')).toBe('before');
    expect(state('2026-11-26T04:59:59.999Z')).toBe('before');
    expect(state('2026-11-26T05:00:00.000Z')).toBe('open');
    expect(state('2026-11-26T16:10:00.000Z')).toBe('open');
    expect(state('2026-11-26T20:59:59.999Z')).toBe('open');
    expect(state('2026-11-26T21:00:00.000Z')).toBe('after');
  });

  it('keeps a 16:00 Manila booking startable at 16:00 Manila and closes it at 18:00 Manila', () => {
    const start = at('2026-11-26T16:00:00.000Z');
    const end = at('2026-11-26T18:00:00.000Z');
    const state = (now: string) => startWindowState({ now: at(now), startAt: start, endAt: end, timeZone: MANILA });
    expect(state('2026-11-25T15:59:59.000Z')).toBe('before');
    expect(state('2026-11-25T16:00:00.000Z')).toBe('open');
    expect(state('2026-11-26T08:00:00.000Z')).toBe('open');
    expect(state('2026-11-26T10:00:00.000Z')).toBe('after');
    expect(state('2026-11-26T16:00:00.000Z')).toBe('after');
  });

  it('opens a Douala booking at Douala midnight and refuses the end instant', () => {
    const start = at('2026-11-24T08:00:00.000Z');
    const end = at('2026-11-25T08:00:00.000Z');
    const state = (now: string) => startWindowState({ now: at(now), startAt: start, endAt: end, timeZone: DOUALA });
    expect(state('2026-11-23T22:59:59.999Z')).toBe('before');
    expect(state('2026-11-23T23:00:00.000Z')).toBe('open');
    expect(state('2026-11-25T06:59:59.999Z')).toBe('open');
    expect(state('2026-11-25T07:00:00.000Z')).toBe('after');
  });

  it('follows Toronto midnight on the DST change days', () => {
    const spring = at('2026-03-08T10:00:00.000Z');
    const springEnd = at('2026-03-08T14:00:00.000Z');
    const springState = (now: string) =>
      startWindowState({ now: at(now), startAt: spring, endAt: springEnd, timeZone: TORONTO });
    expect(springState('2026-03-08T04:59:59.000Z')).toBe('before');
    expect(springState('2026-03-08T05:00:00.000Z')).toBe('open');
    expect(springState('2026-03-08T17:59:59.000Z')).toBe('open');
    expect(springState('2026-03-08T18:00:00.000Z')).toBe('after');

    const fall = at('2026-11-01T10:00:00.000Z');
    const fallEnd = at('2026-11-01T14:00:00.000Z');
    const fallState = (now: string) => startWindowState({ now: at(now), startAt: fall, endAt: fallEnd, timeZone: TORONTO });
    expect(fallState('2026-11-01T03:59:59.000Z')).toBe('before');
    expect(fallState('2026-11-01T04:00:00.000Z')).toBe('open');
    expect(fallState('2026-11-01T18:59:59.000Z')).toBe('open');
    expect(fallState('2026-11-01T19:00:00.000Z')).toBe('after');
  });

  it('skips a missing date instead of closing the window', () => {
    expect(startWindowState({
      now: at('2026-11-24T12:00:00.000Z'),
      startAt: new Date(NaN),
      endAt: new Date(NaN),
      timeZone: DOUALA,
    })).toBe('unknown');
  });
});

describe('unpaid Mobile Money cutoff', () => {
  const due = (now: string, startAt: Date, timeZone: string, pending = false, policyVersion: number | null = null) =>
    reservedUnpaidDue({ now: at(now), startAt, timeZone, policyVersion, pickupInspectionPending: pending });

  it('an open pickup check pauses the cutoff, but a flagged one (correction requested) does not', () => {
    const start = at('2026-11-24T08:00:00.000Z');
    const base = { now: at('2026-11-24T23:00:00.000Z'), startAt: start, timeZone: DOUALA, policyVersion: 1, pickupInspectionPending: true };
    expect(reservedUnpaidDue(base)).toBe(false);
    expect(reservedUnpaidDue({ ...base, pickupCheckFlagged: true })).toBe(true);
    expect(reservedUnpaidDue({ ...base, now: at('2026-11-24T22:59:59.999Z'), pickupCheckFlagged: true })).toBe(false);
  });

  it('cancels a Douala reservation at Douala midnight after the start day', () => {
    const start = at('2026-11-24T08:00:00.000Z');
    expect(due('2026-11-24T10:00:00.000Z', start, DOUALA)).toBe(false);
    expect(due('2026-11-24T22:59:59.999Z', start, DOUALA)).toBe(false);
    expect(due('2026-11-24T23:00:00.000Z', start, DOUALA)).toBe(true);
  });

  it('does not cancel a Toronto reservation at 7 PM on the start day', () => {
    const start = at('2026-11-26T12:00:00.000Z');
    expect(due('2026-11-27T00:00:00.000Z', start, TORONTO)).toBe(false);
    expect(due('2026-11-27T04:59:59.999Z', start, TORONTO)).toBe(false);
    expect(due('2026-11-27T05:00:00.000Z', start, TORONTO)).toBe(true);
  });

  it('waits for Manila midnight, not UTC midnight', () => {
    const start = at('2026-11-26T09:00:00.000Z');
    expect(due('2026-11-26T15:59:59.999Z', start, MANILA)).toBe(false);
    expect(due('2026-11-26T16:00:00.000Z', start, MANILA)).toBe(true);
  });

  it('uses the daylight-saving offset on a DST change day', () => {
    // Start day 31 Oct (EDT): the day ends at 04:00Z, before the clocks go back.
    const start = at('2026-10-31T12:00:00.000Z');
    expect(due('2026-11-01T03:59:59.999Z', start, TORONTO)).toBe(false);
    expect(due('2026-11-01T04:00:00.000Z', start, TORONTO)).toBe(true);
  });

  it('pauses the unpaid cancel while pickup photos are still pending', () => {
    expect(due('2026-11-26T00:00:00.000Z', at('2026-11-24T08:00:00.000Z'), DOUALA, true, 1)).toBe(false);
  });

  it('exposes the end of the start day as a real instant for the countdown', () => {
    expect(endOfStartDayInstant(at('2026-11-26T12:00:00.000Z'), TORONTO).toISOString()).toBe('2026-11-27T05:00:00.000Z');
    expect(endOfStartDayInstant(at('2026-11-24T08:00:00.000Z'), DOUALA).toISOString()).toBe('2026-11-24T23:00:00.000Z');
    expect(endOfStartDayInstant(at('2026-11-26T16:00:00.000Z'), MANILA).toISOString()).toBe('2026-11-26T16:00:00.000Z');
    expect(endOfStartDayInstant(at('2026-10-31T12:00:00.000Z'), TORONTO).toISOString()).toBe('2026-11-01T04:00:00.000Z');
  });
});

describe('no-show', () => {
  const noShow = (now: string, endAt: Date, timeZone: string, actualStartAt: string | null = null, status = 'confirmed') =>
    isNoShow({ status, actualStartAt, endAt, now: at(now), timeZone });

  it('does not treat a Toronto 12:00-16:00 booking as a no-show at 11 AM Toronto', () => {
    const end = at('2026-11-26T16:00:00.000Z');
    expect(noShow('2026-11-26T16:00:00.000Z', end, TORONTO)).toBe(false);
    expect(noShow('2026-11-26T20:59:59.999Z', end, TORONTO)).toBe(false);
    expect(noShow('2026-11-26T21:00:00.000Z', end, TORONTO)).toBe(true);
  });

  it('marks Douala and Manila no-shows at the local end time, not hours late', () => {
    const douala = at('2026-11-25T08:00:00.000Z');
    expect(noShow('2026-11-25T06:59:59.999Z', douala, DOUALA)).toBe(false);
    expect(noShow('2026-11-25T07:00:00.000Z', douala, DOUALA)).toBe(true);
    const manila = at('2026-11-26T18:00:00.000Z');
    expect(noShow('2026-11-26T09:59:59.999Z', manila, MANILA)).toBe(false);
    expect(noShow('2026-11-26T10:00:00.000Z', manila, MANILA)).toBe(true);
  });

  it('uses the right Toronto offset on DST days', () => {
    expect(noShow('2026-03-08T19:59:59.000Z', at('2026-03-08T16:00:00.000Z'), TORONTO)).toBe(false);
    expect(noShow('2026-03-08T20:00:00.000Z', at('2026-03-08T16:00:00.000Z'), TORONTO)).toBe(true);
    expect(noShow('2026-11-01T20:59:59.000Z', at('2026-11-01T16:00:00.000Z'), TORONTO)).toBe(false);
    expect(noShow('2026-11-01T21:00:00.000Z', at('2026-11-01T16:00:00.000Z'), TORONTO)).toBe(true);
  });

  it('never flags a started or non-confirmed booking', () => {
    const end = at('2026-11-25T08:00:00.000Z');
    expect(noShow('2026-11-30T00:00:00.000Z', end, DOUALA, '2026-11-24T12:00:00.000Z')).toBe(false);
    expect(noShow('2026-11-30T00:00:00.000Z', end, DOUALA, null, 'reserved')).toBe(false);
    expect(noShow('2026-11-30T00:00:00.000Z', new Date(NaN), DOUALA)).toBe(false);
  });
});

describe('start day and wall clock checks', () => {
  it('matches the stored date on the listing clock', () => {
    const start = at('2026-11-24T08:00:00.000Z');
    expect(isStartDay(start, at('2026-11-24T04:30:00.000Z'), TORONTO)).toBe(false);
    expect(isStartDay(start, at('2026-11-24T05:00:00.000Z'), TORONTO)).toBe(true);
    expect(isStartDay(start, at('2026-11-25T04:59:59.000Z'), TORONTO)).toBe(true);
    expect(isStartDay(start, at('2026-11-23T23:30:00.000Z'), DOUALA)).toBe(true);
    expect(isStartDay(start, at('2026-11-23T22:59:59.000Z'), DOUALA)).toBe(false);
    expect(isStartDay(start, at('2026-11-24T16:00:00.000Z'), MANILA)).toBe(false);
    expect(isStartDay(start, at('2026-11-23T16:00:00.000Z'), MANILA)).toBe(true);
  });

  it('reports when the listing clock reaches a stored time', () => {
    const end = at('2026-11-26T16:00:00.000Z');
    expect(wallClockReached(end, at('2026-11-26T20:59:59.000Z'), TORONTO)).toBe(false);
    expect(wallClockReached(end, at('2026-11-26T21:00:00.000Z'), TORONTO)).toBe(true);
    expect(wallClockReached(new Date(NaN), at('2026-11-26T21:00:00.000Z'), TORONTO)).toBe(false);
  });
});

describe('rental_mark_started window', () => {
  const migration = (name: string) =>
    readFileSync(join(__dirname, `../../../../hasura/migrations/Rendasua/${name}/up.sql`), 'utf8');

  it('compares p_at on the listing clock and stores a real unpaid deadline', () => {
    const sql = migration('20261126190000_rental_wall_clock_deadlines');
    expect(sql).toContain("RAISE EXCEPTION 'rental_start_window'");
    expect(sql).toContain('public.rental_wall_now(p_at, v_country) < v_opens');
    expect(sql).toContain('public.rental_wall_now(p_at, v_country) >= v_booking.end_at');
    expect(sql).toContain('actual_start_at = p_at');
    expect(sql).toContain(
      'public.rental_wall_to_instant(public.rental_end_of_start_day(start_at, v_country), v_country)'
    );
    expect(sql).not.toContain('application_configurations');
    const wall = migration('20261126120000_rental_start_wall_clock');
    expect(wall).toContain("date_trunc('day', p_start AT TIME ZONE 'UTC')");
  });
});
