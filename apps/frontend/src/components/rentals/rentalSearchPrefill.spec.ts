import { searchPrefillRanges } from './rentalSearchPrefill';

describe('searchPrefillRanges', () => {
  it('keeps one all-day window per day when the search has no times', () => {
    const rows = searchPrefillRanges({ startDate: '2026-11-14', endDate: '2026-11-17', hourly: true });
    expect(rows.map((row) => row.calendarDate)).toEqual(['2026-11-14', '2026-11-15', '2026-11-16']);
    expect(rows.every((row) => row.billing === 'all_day')).toBe(true);
  });

  it('opens the first day and closes the last day at the chosen times, hourly', () => {
    const rows = searchPrefillRanges({ startDate: '2026-11-14', endDate: '2026-11-17', startTime: '13:00', endTime: '15:00', hourly: true });
    expect(rows.map((row) => row.billing)).toEqual(['hourly', 'all_day', 'hourly']);
    expect(new Date(rows[0].startMs).getHours()).toBe(13);
    expect(new Date(rows[2].endMs).getHours()).toBe(15);
  });

  it('bills whole days when the listing has no hourly price', () => {
    const rows = searchPrefillRanges({ startDate: '2026-11-14', endDate: '2026-11-16', startTime: '13:00', hourly: false });
    expect(rows.every((row) => row.billing === 'all_day')).toBe(true);
  });

  it('drops a day whose chosen window is empty', () => {
    expect(searchPrefillRanges({ startDate: '2026-11-14', endDate: '2026-11-15', startTime: '19:00', hourly: true })).toEqual([]);
  });
});
