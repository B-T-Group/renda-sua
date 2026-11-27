import {
  describeRentalDateRange,
  formatRangeDates,
  formatSearchStay,
  formatSearchStayRange,
  marketTimeZone,
  nearbyRanges,
  publishRentalSearchStay,
  rangeFromNextStart,
  rangeFromSearchParams,
  rentalDateRange,
  timesOf,
  subscribeRentalSearchStay,
  weekendRange,
} from './rentalSearchDates';

describe('rental search dates', () => {
  const tuesday = new Date(2026, 10, 10);

  it('builds this weekend from a Tuesday', () => {
    expect(weekendRange(tuesday)).toMatchObject({ startDate: '2026-11-14', endDate: '2026-11-16', dayCount: 2 });
  });

  it('keeps Sunday as the remaining weekend day', () => {
    expect(weekendRange(new Date(2026, 10, 15)).dayCount).toBe(1);
    expect(weekendRange(new Date(2026, 10, 14)).dayCount).toBe(2);
  });

  it('labels the booked days the same way a booking does', () => {
    const range = { startDate: '2026-11-22', endDate: '2026-11-25', dayCount: 3 };
    const days = (count: number) => (count === 1 ? '1 day' : `${count} days`);
    const jours = (count: number) => (count === 1 ? '1 jour' : `${count} jours`);
    expect(formatSearchStay(range, 'en', days)).toBe('22\u201324 Nov · 3 days');
    expect(formatSearchStay(range, 'fr', jours)).toBe('22\u201324 nov. · 3 jours');
    expect(formatSearchStayRange(range, 'en')).toBe('22\u201324 Nov');
    expect(formatSearchStayRange(range, 'fr')).toBe('22\u201324 nov.');
  });

  it('labels a 27–29 exclusive stay as the two booked days, matching the priced count', () => {
    const range = { startDate: '2026-11-27', endDate: '2026-11-29', dayCount: 2 };
    const days = (count: number) => (count === 1 ? '1 day' : `${count} days`);
    expect(range.dayCount).toBe(2);
    expect(formatSearchStayRange(range, 'en')).toBe('27\u201328 Nov');
    expect(formatSearchStayRange(range, 'fr')).toBe('27\u201328 nov.');
    expect(formatSearchStay(range, 'en', days)).toBe('27\u201328 Nov · 2 days');
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

  it('tells the results list when the request sheet changes dates', () => {
    const seen: string[] = [];
    const stop = subscribeRentalSearchStay((range) => seen.push(range.startDate));
    publishRentalSearchStay({ startDate: '2026-11-16', endDate: '2026-11-19', dayCount: 3 });
    stop();
    publishRentalSearchStay({ startDate: '2026-11-20', endDate: '2026-11-21', dayCount: 1 });
    expect(seen).toEqual(['2026-11-16']);
  });

  it('uses the Cameroon clock for the market', () => {
    expect(marketTimeZone('cm')).toBe('Africa/Douala');
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

  it('keeps valid clock times from a search link and rejects malformed ones', () => {
    expect(rangeFromSearchParams('2026-11-14', '2026-11-16', '09:30', '17:00')).toEqual({
      startDate: '2026-11-14',
      endDate: '2026-11-16',
      dayCount: 2,
      startTime: '09:30',
      endTime: '17:00',
    });
    expect(rangeFromSearchParams('2026-11-14', '2026-11-16', '9am', '17:00')).toBeNull();
    expect(rangeFromSearchParams('2026-11-14', '2026-11-16', '09:00', '25:00')).toBeNull();
  });

  it('rejects a one-day window that ends before it starts', () => {
    expect(rangeFromSearchParams('2026-11-14', '2026-11-15', '17:00', '09:00')).toBeNull();
    expect(rangeFromSearchParams('2026-11-14', '2026-11-15', '09:00', '17:00')).not.toBeNull();
  });

  it('carries times through a shift and a next-free-start range', () => {
    const range = rangeFromSearchParams('2026-11-14', '2026-11-16', '09:00', '17:00')!;
    expect(timesOf(range)).toEqual({ startTime: '09:00', endTime: '17:00' });
    expect(timesOf({})).toEqual({});
    expect(rangeFromNextStart('2026-11-18', 2, timesOf(range))).toMatchObject({
      startDate: '2026-11-18',
      endDate: '2026-11-20',
      startTime: '09:00',
      endTime: '17:00',
    });
  });
});
