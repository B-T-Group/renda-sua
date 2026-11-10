import {
  formatRangeDates,
  nearbyRanges,
  rangeFromNextStart,
  todayRange,
  weekendRange,
  weekRange,
} from './rentalSearchDates';

describe('rental search dates', () => {
  const tuesday = new Date(2026, 10, 10);

  it('builds Today, this weekend, and one week from a Tuesday', () => {
    expect(todayRange(tuesday)).toMatchObject({ startDate: '2026-11-10', endDate: '2026-11-11', dayCount: 1 });
    expect(weekendRange(tuesday)).toMatchObject({ startDate: '2026-11-14', endDate: '2026-11-16', dayCount: 2 });
    expect(weekRange(tuesday)).toMatchObject({ startDate: '2026-11-10', endDate: '2026-11-17', dayCount: 7 });
  });

  it('keeps Sunday as the remaining weekend day', () => {
    expect(weekendRange(new Date(2026, 10, 15)).dayCount).toBe(1);
    expect(weekendRange(new Date(2026, 10, 14)).dayCount).toBe(2);
  });

  it('labels 12–15 Nov as three days and suggests later windows', () => {
    const range = { startDate: '2026-11-12', endDate: '2026-11-15', dayCount: 3 };
    expect(formatRangeDates(range, 'en')).toContain('12–15');
    const nearby = nearbyRanges(range, tuesday);
    expect(nearby[0]).toMatchObject({ startDate: '2026-11-16', endDate: '2026-11-19' });
    expect(nearby.some((row) => row.startDate === '2026-11-14')).toBe(true);
    expect(rangeFromNextStart('2026-11-18', 3)).toMatchObject({
      startDate: '2026-11-18',
      endDate: '2026-11-21',
      dayCount: 3,
    });
  });
});
