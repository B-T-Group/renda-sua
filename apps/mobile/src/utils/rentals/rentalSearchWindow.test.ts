import {
  ANY_TIME_LISTING,
  formatSearchWindow,
  formatSearchWindowLine,
  isTimedRange,
  pickedDaysFromRange,
  rangeFromPickedDays,
  rangeFromWallMs,
  todayWindow,
  weekWindow,
  weekendWindow,
} from './rentalSearchWindow';
import { keyToUtcMs } from './dayHoursPicker';

const UTC = 'UTC';
const at = (day: string, hour: number, minute = 0) => Date.parse(`${day}T00:00:00Z`) + (hour * 60 + minute) * 60_000;

describe('rental search window', () => {
  it('opens every hour of every day so the picker shows the whole calendar', () => {
    expect(ANY_TIME_LISTING.weekly).toHaveLength(7);
    expect(ANY_TIME_LISTING.weekly.every((row) => row.start_time === '00:00' && row.end_time === '24:00')).toBe(true);
  });

  it('turns wall-clock instants into a window with times only on partial edges', () => {
    expect(rangeFromWallMs(at('2026-11-10', 0), at('2026-11-12', 24))).toEqual({
      startDate: '2026-11-10',
      endDate: '2026-11-13',
      dayCount: 3,
    });
    expect(rangeFromWallMs(at('2026-11-10', 9, 30), at('2026-11-12', 17))).toEqual({
      startDate: '2026-11-10',
      endDate: '2026-11-13',
      dayCount: 3,
      startTime: '09:30',
      endTime: '17:00',
    });
    expect(rangeFromWallMs(at('2026-11-10', 9), at('2026-11-10', 9))).toBeNull();
  });

  it('reads picked days as first start to last end, with whole days in between', () => {
    const range = rangeFromPickedDays([
      { key: '2026-11-12', mode: 'hours', start: 0, end: 15 },
      { key: '2026-11-10', mode: 'hours', start: 9, end: 24 },
      { key: '2026-11-11', mode: 'full', start: 0, end: 24 },
    ]);
    expect(range).toMatchObject({ startDate: '2026-11-10', endDate: '2026-11-13', startTime: '09:00', endTime: '15:00' });
    expect(rangeFromPickedDays([])).toBeNull();
  });

  it('round-trips a window through picked days', () => {
    const range = rangeFromWallMs(at('2026-11-10', 9), at('2026-11-12', 15))!;
    const days = pickedDaysFromRange(range);
    expect(days).toEqual([
      { key: '2026-11-10', mode: 'hours', start: 9, end: 24 },
      { key: '2026-11-11', mode: 'full', start: 0, end: 24 },
      { key: '2026-11-12', mode: 'hours', start: 0, end: 15 },
    ]);
    expect(rangeFromPickedDays(days)).toEqual(range);
    expect(keyToUtcMs('2026-11-10')).toBe(at('2026-11-10', 0));
  });

  it('starts Today at the earliest bookable hour, two hours from now', () => {
    const range = todayWindow(at('2026-11-10', 10, 20), UTC);
    expect(range).toMatchObject({ startDate: '2026-11-10', endDate: '2026-11-11', dayCount: 1, startTime: '13:00' });
    expect(range.endTime).toBeUndefined();
  });

  it('moves Today to tomorrow morning late in the evening', () => {
    expect(todayWindow(at('2026-11-10', 21, 30), UTC)).toMatchObject({ startDate: '2026-11-11', startTime: '08:00' });
  });

  it('starts the weekend Saturday at 09:00 and ends it after Sunday', () => {
    expect(weekendWindow(at('2026-11-10', 10), UTC)).toMatchObject({
      startDate: '2026-11-14',
      endDate: '2026-11-16',
      dayCount: 2,
      startTime: '09:00',
    });
  });

  it('starts the weekend at the earliest hour while it is already Saturday afternoon', () => {
    expect(weekendWindow(at('2026-11-14', 14), UTC)).toMatchObject({ startDate: '2026-11-14', startTime: '16:00' });
  });

  it('jumps to next weekend once Sunday is too late to start', () => {
    expect(weekendWindow(at('2026-11-15', 23), UTC)).toMatchObject({ startDate: '2026-11-21', startTime: '09:00' });
  });

  it('runs one week from the earliest bookable hour', () => {
    expect(weekWindow(at('2026-11-10', 10, 20), UTC)).toMatchObject({
      startDate: '2026-11-10',
      endDate: '2026-11-18',
      startTime: '13:00',
      endTime: '13:00',
    });
  });

  it('shows times only when the window has them', () => {
    expect(isTimedRange({})).toBe(false);
    expect(isTimedRange({ startTime: '09:00' })).toBe(true);
    const timed = rangeFromWallMs(at('2026-11-14', 9), at('2026-11-15', 24))!;
    expect(formatSearchWindow(timed, 'en')).toMatch(/Sat.*09:00.*Sun/);
    expect(formatSearchWindowLine(timed, 'en', (n) => `${n} days`)).toBe(formatSearchWindow(timed, 'en'));
  });

  it('words a same-day window with from, until, or both', () => {
    const from = rangeFromWallMs(at('2026-11-14', 13), at('2026-11-14', 24))!;
    const until = rangeFromWallMs(at('2026-11-14', 0), at('2026-11-14', 17))!;
    const both = rangeFromWallMs(at('2026-11-14', 9), at('2026-11-14', 17))!;
    expect(formatSearchWindow(from, 'en')).toContain('from 13:00');
    expect(formatSearchWindow(until, 'en')).toContain('until 17:00');
    expect(formatSearchWindow(both, 'en')).toMatch(/09:00.*17:00/);
    expect(formatSearchWindow(from, 'fr')).toContain('dès');
    expect(formatSearchWindow(until, 'fr')).toContain("jusqu'à");
  });

  it('keeps the day count for whole-day windows', () => {
    const whole = rangeFromWallMs(at('2026-11-14', 0), at('2026-11-15', 24))!;
    expect(formatSearchWindowLine(whole, 'en', (n) => `${n} days`)).toContain('2 days');
  });
});
