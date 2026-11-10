import { allDaySelectionsForRange } from './rentalSearchPreset';

describe('rental search preset', () => {
  it('prefills one all-day row per day from 12 Nov through 15 Nov', () => {
    const rows = allDaySelectionsForRange({
      startDate: '2026-11-12',
      endDate: '2026-11-15',
      dayCount: 3,
    });
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.calendarDate)).toEqual(['2026-11-12', '2026-11-13', '2026-11-14']);
    expect(rows.every((row) => row.billing === 'all_day')).toBe(true);
  });
});
