import { wallClockToInstantMs, wallIsoToInstantIso, wallNow } from './wall-clock';

const ms = (iso: string) => Date.parse(iso);

describe('listing wall clock', () => {
  it('reads now on the listing clock in the start_at encoding', () => {
    const real = new Date('2026-11-26T14:40:00.000Z');
    expect(wallNow(real, 'America/Toronto').toISOString()).toBe('2026-11-26T09:40:00.000Z');
    expect(wallNow(real, 'Africa/Douala').toISOString()).toBe('2026-11-26T15:40:00.000Z');
    expect(wallNow(real, 'Asia/Manila').toISOString()).toBe('2026-11-26T22:40:00.000Z');
    expect(wallNow(new Date('2026-11-26T14:40:00.123Z'), 'America/Toronto').toISOString()).toBe('2026-11-26T09:40:00.123Z');
  });

  it('turns a stored wall-clock time into the real instant', () => {
    expect(wallIsoToInstantIso('2026-11-26T12:00:00.000Z', 'America/Toronto')).toBe('2026-11-26T17:00:00.000Z');
    expect(wallIsoToInstantIso('2026-07-01T12:00:00.000Z', 'America/Toronto')).toBe('2026-07-01T16:00:00.000Z');
    expect(wallIsoToInstantIso('2026-11-26T12:00:00.000Z', 'Africa/Douala')).toBe('2026-11-26T11:00:00.000Z');
    expect(wallIsoToInstantIso('2026-11-26T12:00:00.000Z', 'Asia/Manila')).toBe('2026-11-26T04:00:00.000Z');
    expect(wallIsoToInstantIso('2026-11-26T12:00:00.250Z', 'America/Toronto')).toBe('2026-11-26T17:00:00.250Z');
    expect(wallIsoToInstantIso(null, 'America/Toronto')).toBeNull();
    expect(wallIsoToInstantIso('nope', 'America/Toronto')).toBeNull();
  });

  it('matches Postgres AT TIME ZONE on the Toronto DST days', () => {
    // Skipped 02:30 on 8 Mar resolves with the pre-jump offset (03:30 EDT).
    expect(wallClockToInstantMs(ms('2026-03-08T02:30:00Z'), 'America/Toronto')).toBe(ms('2026-03-08T07:30:00Z'));
    expect(wallClockToInstantMs(ms('2026-03-08T00:00:00Z'), 'America/Toronto')).toBe(ms('2026-03-08T05:00:00Z'));
    expect(wallClockToInstantMs(ms('2026-03-09T00:00:00Z'), 'America/Toronto')).toBe(ms('2026-03-09T04:00:00Z'));
    // Repeated 01:30 on 1 Nov resolves to standard time (second pass).
    expect(wallClockToInstantMs(ms('2026-11-01T01:30:00Z'), 'America/Toronto')).toBe(ms('2026-11-01T06:30:00Z'));
    expect(wallClockToInstantMs(ms('2026-11-01T00:00:00Z'), 'America/Toronto')).toBe(ms('2026-11-01T04:00:00Z'));
    expect(wallClockToInstantMs(ms('2026-11-02T00:00:00Z'), 'America/Toronto')).toBe(ms('2026-11-02T05:00:00Z'));
  });

  it('round-trips every hour of a Toronto year outside the DST gap', () => {
    for (let t = ms('2026-01-01T00:00:00Z'); t < ms('2027-01-01T00:00:00Z'); t += 3_600_000) {
      const wall = wallNow(new Date(t), 'America/Toronto').getTime();
      const back = wallClockToInstantMs(wall, 'America/Toronto');
      expect(wallNow(new Date(back), 'America/Toronto').getTime()).toBe(wall);
    }
  });
});
