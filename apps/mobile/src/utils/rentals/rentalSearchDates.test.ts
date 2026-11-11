import {
  calendarDateInTimeZone,
  describeRentalDateRange,
  formatRangeDates,
  formatSheetDateLine,
  marketTimeZone,
  nearbyRanges,
  publishRentalSearchStay,
  rangeFromNextStart,
  rangeFromSearchParams,
  rentalDateRange,
  subscribeRentalSearchStay,
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

  it('writes the request-sheet date line in English and French', () => {
    const range = { startDate: '2026-11-14', endDate: '2026-11-16', dayCount: 2 };
    expect(formatSheetDateLine(range, 'en', '2 days')).toBe('14–16 Nov · 2 days');
    expect(formatSheetDateLine(range, 'fr', '2 jours')).toBe('14–16 nov. · 2 jours');
  });

  it('tells the results list when the request sheet changes dates', () => {
    const seen: string[] = [];
    const stop = subscribeRentalSearchStay((range) => seen.push(range.startDate));
    publishRentalSearchStay({ startDate: '2026-11-16', endDate: '2026-11-19', dayCount: 3 });
    stop();
    publishRentalSearchStay({ startDate: '2026-11-20', endDate: '2026-11-21', dayCount: 1 });
    expect(seen).toEqual(['2026-11-16']);
  });

  it('uses the Cameroon clock for today, including just before UTC midnight', () => {
    expect(marketTimeZone('cm')).toBe('Africa/Douala');
    expect(calendarDateInTimeZone(new Date('2026-11-09T23:30:00Z'), 'Africa/Douala')).toMatchObject({
      year: 2026,
      month: 11,
      day: 10,
      iso: '2026-11-10',
    });
  });

  it('reports a span over 30 days instead of dropping it', () => {
    const start = new Date(2026, 10, 1);
    const end = new Date(2026, 11, 2);
    expect(describeRentalDateRange(start, end)).toEqual({
      status: 'too_long',
      startDate: '2026-11-01',
      endDate: '2026-12-02',
      dayCount: 31,
    });
    expect(rentalDateRange(start, end)).toBeNull();
    expect(describeRentalDateRange(start, new Date(2026, 11, 1))).toEqual({
      status: 'ok',
      range: { startDate: '2026-11-01', endDate: '2026-12-01', dayCount: 30 },
    });
  });

  it('keeps a search-link stay only when both dates parse and the exclusive end is 1 to 30 days', () => {
    expect(rangeFromSearchParams('2026-11-14', '2026-11-16')).toEqual({
      startDate: '2026-11-14',
      endDate: '2026-11-16',
      dayCount: 2,
    });
    expect(rangeFromSearchParams('2026-11-01', '2026-12-01')).toMatchObject({ dayCount: 30 });
    expect(rangeFromSearchParams('2026-11-01', '2026-12-02')).toBeNull();
    expect(rangeFromSearchParams('2026-11-16', '2026-11-14')).toBeNull();
    expect(rangeFromSearchParams('2026-11-14', '2026-11-14')).toBeNull();
    expect(rangeFromSearchParams('2026-11-14')).toBeNull();
    expect(rangeFromSearchParams(undefined, '2026-11-16')).toBeNull();
    expect(rangeFromSearchParams('', '2026-11-16')).toBeNull();
    expect(rangeFromSearchParams('2026-13-01', '2026-13-05')).toBeNull();
    expect(rangeFromSearchParams(' 2026-11-14', '2026-11-16')).toBeNull();
  });
});
