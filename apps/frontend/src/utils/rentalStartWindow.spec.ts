import { BOOKING_CLOCK, formatZonedDay, formatZonedTime, formatZonedWhen, pickupPhase, utcMidnight, zonedStartOfDay } from './rentalStartWindow';

const TORONTO = 'America/Toronto';
const DOUALA = 'Africa/Douala';
const START_TO = '2026-11-24T15:00:00.000Z';
const END_TO = '2026-11-26T23:00:00.000Z';
const START_CM = '2026-11-24T08:00:00.000Z';
const END_CM = '2026-11-29T17:00:00.000Z';

describe('pickup window on the stored wall-clock date', () => {
  // start/end are listing wall clock stored as UTC components; `now` is a real instant.
  it('opens a Toronto pickup at Toronto midnight, not 7 PM the evening before', () => {
    expect(utcMidnight(START_TO)).toBe(Date.parse('2026-11-24T00:00:00.000Z'));
    expect(phase(TORONTO, START_TO, END_TO, '2026-11-24T00:00:00.000Z')).toBe('before');
    expect(phase(TORONTO, START_TO, END_TO, '2026-11-24T04:59:00.000Z')).toBe('before');
    expect(phase(TORONTO, START_TO, END_TO, '2026-11-24T05:00:00.000Z')).toBe('today');
    expect(phase(TORONTO, START_TO, END_TO, '2026-11-24T20:00:00.000Z')).toBe('today');
    expect(phase(TORONTO, START_TO, END_TO, '2026-11-24T20:01:00.000Z')).toBe('late');
    expect(phase(TORONTO, START_TO, END_TO, '2026-11-27T03:59:00.000Z')).toBe('late');
    expect(phase(TORONTO, START_TO, END_TO, '2026-11-27T04:00:00.000Z')).toBe('closed');
  });

  it('keeps an 08:00 Douala booking on that clock, not 09:00', () => {
    expect(zonedStartOfDay(START_CM, DOUALA)).toBe(Date.parse('2026-11-23T23:00:00.000Z'));
    expect(utcMidnight(START_CM)).toBe(Date.parse('2026-11-24T00:00:00.000Z'));
    expect(phase(DOUALA, START_CM, END_CM, '2026-11-23T22:59:00.000Z')).toBe('before');
    expect(phase(DOUALA, START_CM, END_CM, '2026-11-23T23:00:00.000Z')).toBe('today');
    expect(phase(DOUALA, START_CM, END_CM, '2026-11-24T07:00:00.000Z')).toBe('today');
    expect(phase(DOUALA, START_CM, END_CM, '2026-11-24T07:01:00.000Z')).toBe('late');
    expect(formatZonedTime(START_CM, BOOKING_CLOCK)).toBe('08:00');
    expect(formatZonedTime(START_CM, DOUALA)).toBe('09:00');
  });

  it('keeps a 16:00 Manila booking startable at 16:00 Manila', () => {
    const start = '2026-11-26T16:00:00.000Z';
    const end = '2026-11-26T18:00:00.000Z';
    expect(phase('Asia/Manila', start, end, '2026-11-25T15:59:00.000Z')).toBe('before');
    expect(phase('Asia/Manila', start, end, '2026-11-26T08:00:00.000Z')).toBe('today');
    expect(phase('Asia/Manila', start, end, '2026-11-26T10:00:00.000Z')).toBe('closed');
  });

  it('follows Toronto midnight on the DST change days', () => {
    expect(phase(TORONTO, '2026-03-08T10:00:00.000Z', '2026-03-08T14:00:00.000Z', '2026-03-08T04:59:00.000Z')).toBe('before');
    expect(phase(TORONTO, '2026-03-08T10:00:00.000Z', '2026-03-08T14:00:00.000Z', '2026-03-08T05:00:00.000Z')).toBe('today');
    expect(phase(TORONTO, '2026-11-01T10:00:00.000Z', '2026-11-01T14:00:00.000Z', '2026-11-01T03:59:00.000Z')).toBe('before');
    expect(phase(TORONTO, '2026-11-01T10:00:00.000Z', '2026-11-01T14:00:00.000Z', '2026-11-01T04:00:00.000Z')).toBe('today');
    expect(phase(TORONTO, '2026-11-01T10:00:00.000Z', '2026-11-01T14:00:00.000Z', '2026-11-01T19:00:00.000Z')).toBe('closed');
  });

  it('formats the pickup day in the listing zone, not the device zone', () => {
    expect(formatZonedDay(START_TO, TORONTO, 'en')).toBe('24 Nov');
    expect(formatZonedTime(START_TO, TORONTO)).toBe('10:00');
    expect(formatZonedTime(START_CM, DOUALA)).toBe('09:00');
    expect(formatZonedWhen(END_TO, TORONTO, 'en')).toBe('Thu 26 Nov · 18:00');
    expect(formatZonedWhen(END_TO, TORONTO, 'fr')).toBe('jeu.\u00a026\u00a0nov. · 18:00');
    expect(formatZonedWhen('2026-11-26T18:00:00Z', 'UTC', 'en', 'America/Toronto')).toBe('Thu, Nov 26 · 6:00 PM');
    expect(formatZonedWhen('2026-11-26T18:00:00Z', 'UTC', 'fr', 'America/Toronto')).toBe('jeu.\u00a026\u00a0nov. · 18:00');
    expect(formatZonedWhen('2026-11-26T18:00:00Z', 'UTC', 'en', 'Africa/Douala')).toBe('Thu 26 Nov · 18:00');
  });
});

function phase(timeZone: string, startAt: string, endAt: string, now: string) {
  return pickupPhase({ now: Date.parse(now), startAt, endAt, timeZone });
}
