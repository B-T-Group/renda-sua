import { DateTime } from 'luxon';
import { parseCalendarDatePartsFromPreferredDate } from './user-timezone.util';

describe('user-timezone.util', () => {
  describe('parseCalendarDatePartsFromPreferredDate', () => {
    it('parses YYYY-MM-DD without local-TZ drift', () => {
      const prev = process.env.TZ;
      process.env.TZ = 'America/Los_Angeles';
      try {
        expect(parseCalendarDatePartsFromPreferredDate('2026-04-06')).toEqual({
          year: 2026,
          month: 4,
          day: 6,
        });
      } finally {
        if (prev === undefined) delete process.env.TZ;
        else process.env.TZ = prev;
      }
    });

    it('uses UTC calendar fields for ISO date-only midnight', () => {
      const d = new Date('2026-04-06');
      expect(parseCalendarDatePartsFromPreferredDate(d)).toEqual({
        year: 2026,
        month: 4,
        day: 6,
      });
    });
  });

  it('Apr 6 08:00 Africa/Libreville maps to 2026-04-06T07:00:00.000Z', () => {
    const { year, month, day } =
      parseCalendarDatePartsFromPreferredDate('2026-04-06');
    const dt = DateTime.fromObject(
      { year, month, day, hour: 8, minute: 0, second: 0 },
      { zone: 'Africa/Libreville' }
    );
    expect(dt.isValid).toBe(true);
    expect(dt.toUTC().toISO()).toBe('2026-04-06T07:00:00.000Z');
  });
});
