import { formatZonedDay, formatZonedTime, formatZonedWhen, pickupPhase, zonedStartOfDay } from './rentalStartWindow';

const TORONTO = 'America/Toronto';
const DOUALA = 'Africa/Douala';
const START_TO = '2026-11-24T15:00:00.000Z';
const END_TO = '2026-11-26T23:00:00.000Z';
const START_CM = '2026-11-24T08:00:00.000Z';
const END_CM = '2026-11-29T17:00:00.000Z';

describe('pickup window in the listing time zone', () => {
  it('locks until midnight on the Toronto start day', () => {
    expect(zonedStartOfDay(START_TO, TORONTO)).toBe(Date.parse('2026-11-24T05:00:00.000Z'));
    expect(phase(TORONTO, START_TO, END_TO, '2026-11-24T04:59:00.000Z')).toBe('before');
    expect(phase(TORONTO, START_TO, END_TO, '2026-11-24T05:00:00.000Z')).toBe('today');
    expect(phase(TORONTO, START_TO, END_TO, '2026-11-24T15:00:00.000Z')).toBe('today');
    expect(phase(TORONTO, START_TO, END_TO, '2026-11-24T15:01:00.000Z')).toBe('late');
    expect(phase(TORONTO, START_TO, END_TO, END_TO)).toBe('closed');
  });

  it('opens at Douala midnight, which is the previous UTC evening', () => {
    expect(zonedStartOfDay(START_CM, DOUALA)).toBe(Date.parse('2026-11-23T23:00:00.000Z'));
    expect(phase(DOUALA, START_CM, END_CM, '2026-11-23T22:59:00.000Z')).toBe('before');
    expect(phase(DOUALA, START_CM, END_CM, '2026-11-23T23:00:00.000Z')).toBe('today');
    expect(phase(DOUALA, START_CM, END_CM, '2026-11-24T08:01:00.000Z')).toBe('late');
  });

  it('formats the pickup day in the listing zone, not the device zone', () => {
    expect(formatZonedDay(START_TO, TORONTO, 'en')).toBe('24 Nov');
    expect(formatZonedTime(START_TO, TORONTO)).toBe('10:00');
    expect(formatZonedTime(START_CM, DOUALA)).toBe('09:00');
    expect(formatZonedWhen(END_TO, TORONTO, 'en')).toBe('Thu 26 Nov · 18:00');
  });
});

function phase(timeZone: string, startAt: string, endAt: string, now: string) {
  return pickupPhase({ now: Date.parse(now), startAt, endAt, timeZone });
}
