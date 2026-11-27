import {
  ANY_TIME_LISTING,
  formatStayLine,
  formatStayWindow,
  pickedDaysFromStay,
  stayDayCount,
  stayFromParams,
  stayFromPickedDays,
  stayFromWallMs,
} from './rentalSearchWindow';

const at = (day: string, hour: number, minute = 0) => Date.parse(`${day}T00:00:00Z`) + (hour * 60 + minute) * 60_000;

describe('rentalSearchWindow', () => {
  it('opens every hour of every day', () => {
    expect(ANY_TIME_LISTING.weekly).toHaveLength(7);
    expect(ANY_TIME_LISTING.weekly.every((row) => row.start_time === '00:00' && row.end_time === '24:00')).toBe(true);
  });

  it('keeps clock times only on partial edges', () => {
    expect(stayFromWallMs(at('2026-11-10', 0), at('2026-11-12', 24))).toEqual({ startDate: '2026-11-10', endDate: '2026-11-13' });
    expect(stayFromWallMs(at('2026-11-10', 9, 30), at('2026-11-12', 17))).toEqual({
      startDate: '2026-11-10',
      endDate: '2026-11-13',
      startTime: '09:30',
      endTime: '17:00',
    });
    expect(stayFromWallMs(at('2026-11-10', 9), at('2026-11-10', 9))).toBeNull();
  });

  it('reads picked days as first start to last end', () => {
    expect(
      stayFromPickedDays([
        { key: '2026-11-12', mode: 'hours', start: 0, end: 15 },
        { key: '2026-11-10', mode: 'hours', start: 9, end: 24 },
        { key: '2026-11-11', mode: 'full', start: 0, end: 24 },
      ])
    ).toEqual({ startDate: '2026-11-10', endDate: '2026-11-13', startTime: '09:00', endTime: '15:00' });
    expect(stayFromPickedDays([])).toBeNull();
  });

  it('round-trips a window through picked days', () => {
    const stay = stayFromWallMs(at('2026-11-10', 9), at('2026-11-12', 15))!;
    const days = pickedDaysFromStay(stay);
    expect(days).toEqual([
      { key: '2026-11-10', mode: 'hours', start: 9, end: 24 },
      { key: '2026-11-11', mode: 'full', start: 0, end: 24 },
      { key: '2026-11-12', mode: 'hours', start: 0, end: 15 },
    ]);
    expect(stayFromPickedDays(days)).toEqual(stay);
    expect(stayDayCount(stay)).toBe(3);
  });

  it('accepts a link window only when whole and 1 to 30 days', () => {
    expect(stayFromParams('2026-11-14', '2026-11-16')).toEqual({ startDate: '2026-11-14', endDate: '2026-11-16' });
    expect(stayFromParams('2026-11-14', '2026-11-16', '09:00', '17:00')).toMatchObject({ startTime: '09:00', endTime: '17:00' });
    expect(stayFromParams('2026-11-14', '2026-11-16', '9am', '17:00')).toBeNull();
    expect(stayFromParams('2026-11-14', '2026-11-15', '17:00', '09:00')).toBeNull();
    expect(stayFromParams('2026-11-01', '2026-12-02')).toBeNull();
    expect(stayFromParams('2026-11-14', '2026-11-14')).toBeNull();
    expect(stayFromParams(null, '2026-11-16')).toBeNull();
  });

  it('shows times only when the window has them', () => {
    const timed = stayFromWallMs(at('2026-11-14', 9), at('2026-11-15', 24))!;
    expect(formatStayWindow(timed, 'en')).toMatch(/Sat.*09:00.*Sun/);
    expect(formatStayLine(timed, 'en', (n) => `${n} days`)).toBe(formatStayWindow(timed, 'en'));
    const whole = stayFromWallMs(at('2026-11-14', 0), at('2026-11-15', 24))!;
    expect(formatStayLine(whole, 'en', (n) => `${n} days`)).toContain('2 days');
  });

  it('words a same-day window with from, until, or both', () => {
    const from = stayFromWallMs(at('2026-11-14', 13), at('2026-11-14', 24))!;
    const until = stayFromWallMs(at('2026-11-14', 0), at('2026-11-14', 17))!;
    const both = stayFromWallMs(at('2026-11-14', 9), at('2026-11-14', 17))!;
    expect(formatStayWindow(from, 'en')).toContain('from 13:00');
    expect(formatStayWindow(until, 'en')).toContain('until 17:00');
    expect(formatStayWindow(both, 'en')).toMatch(/09:00.*17:00/);
    expect(formatStayWindow(from, 'fr')).toContain('dès');
    expect(formatStayWindow(until, 'fr')).toContain("jusqu'à");
  });
});
