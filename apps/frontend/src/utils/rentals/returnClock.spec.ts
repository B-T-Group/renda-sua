import {
  clockInputAfterWall,
  clockInputToInstantIso,
  dateTimeLocalToInstantIso,
  listingClockInput,
  listingDateTimeLocal,
  listingWallToInstantMs,
  parseClockInput,
  wallIsoInput,
} from './returnClock';

const TORONTO = 'America/Toronto';
const DOUALA = 'Africa/Douala';

describe('returnClock (business return time on the listing clock)', () => {
  it('reads now on the listing clock, whatever the device zone', () => {
    const now = Date.parse('2026-11-26T20:40:00.000Z');
    expect(listingClockInput(now, TORONTO)).toEqual({ date: '2026-11-26', time: '15:40' });
    expect(listingClockInput(now, DOUALA)).toEqual({ date: '2026-11-26', time: '21:40' });
  });

  it('shows a stored end_at as typed, with no zone shift', () => {
    expect(wallIsoInput('2026-11-26T18:00:00.000Z')).toEqual({ date: '2026-11-26', time: '18:00' });
    expect(wallIsoInput('nope')).toBeNull();
  });

  it('sends a typed listing time as the real instant', () => {
    expect(clockInputToInstantIso('2026-11-26', '15:40', TORONTO)).toBe('2026-11-26T20:40:00.000Z');
    expect(clockInputToInstantIso('2026-07-17', '15:40', TORONTO)).toBe('2026-07-17T19:40:00.000Z');
    expect(clockInputToInstantIso('2026-11-26', '15:40', DOUALA)).toBe('2026-11-26T14:40:00.000Z');
  });

  it('round-trips now -> fields -> instant', () => {
    const now = Date.parse('2026-11-26T20:40:00.000Z');
    for (const zone of [TORONTO, DOUALA]) {
      const { date, time } = listingClockInput(now, zone);
      expect(clockInputToInstantIso(date, time, zone)).toBe('2026-11-26T20:40:00.000Z');
    }
  });

  it('resolves DST edges like the server', () => {
    // 01:30 repeats on 1 Nov 2026 in Toronto: standard time (06:30Z).
    expect(new Date(listingWallToInstantMs(Date.UTC(2026, 10, 1, 1, 30), TORONTO)).toISOString()).toBe(
      '2026-11-01T06:30:00.000Z'
    );
    // 02:30 is skipped on 8 Mar 2026: uses EST, so 07:30Z (03:30 EDT).
    expect(new Date(listingWallToInstantMs(Date.UTC(2026, 2, 8, 2, 30), TORONTO)).toISOString()).toBe(
      '2026-03-08T07:30:00.000Z'
    );
  });

  it('rejects bad input', () => {
    expect(parseClockInput('2026-02-30', '10:00')).toBeNull();
    expect(parseClockInput('2026-11-26', '24:00')).toBeNull();
    expect(parseClockInput('26/11/2026', '10:00')).toBeNull();
    expect(clockInputToInstantIso('2026-11-26', '9:5', TORONTO)).toBeNull();
  });

  it('flags overtime against the booked end on the same clock', () => {
    // Toronto 2-6 PM booking returned at 3:40 PM is early, not 3 h late.
    expect(clockInputAfterWall('2026-11-26', '15:40', '2026-11-26T18:00:00.000Z')).toBe(false);
    expect(clockInputAfterWall('2026-11-26', '18:00', '2026-11-26T18:00:00.000Z')).toBe(false);
    expect(clockInputAfterWall('2026-11-26', '18:01', '2026-11-26T18:00:00.000Z')).toBe(true);
  });

  it('reads and writes datetime-local values on the listing clock', () => {
    const now = Date.parse('2026-11-26T20:40:00.000Z');
    expect(listingDateTimeLocal(now, TORONTO)).toBe('2026-11-26T15:40');
    expect(dateTimeLocalToInstantIso('2026-11-26T15:40', TORONTO)).toBe('2026-11-26T20:40:00.000Z');
    expect(dateTimeLocalToInstantIso('2026-11-26T21:40', DOUALA)).toBe('2026-11-26T20:40:00.000Z');
    expect(dateTimeLocalToInstantIso('', TORONTO)).toBeNull();
  });
});
