import {
  DAY_HOURS_CODES,
  blockHoursViolation,
  dayHoursPickerViolation,
  daysInARowViolation,
  leadTimeViolation,
  listingModesViolation,
  modeViolation,
  wallClockNowMs,
  type DayHoursWindow,
} from './day-hours.rules';

const MON_SAT = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  is_available: weekday !== 0,
  start_time: weekday !== 0 ? '08:00:00' : null,
  end_time: weekday !== 0 ? '18:00:00' : null,
}));

function hourly(date: string, from: number, to: number): DayHoursWindow {
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    start: new Date(`${date}T${pad(from)}:00:00.000Z`),
    end: new Date(`${date}T${pad(to)}:00:00.000Z`),
    billing: 'hourly',
  };
}

function fullDay(date: string): DayHoursWindow {
  return {
    start: new Date(`${date}T08:00:00.000Z`),
    end: new Date(`${date}T18:00:00.000Z`),
    billing: 'all_day',
    calendarDate: date,
  };
}

describe('day-hours picker rules', () => {
  describe('days in a row', () => {
    it('accepts Fri, Sat, Mon when Sunday is closed', () => {
      expect(
        daysInARowViolation([fullDay('2026-11-27'), hourly('2026-11-28', 10, 13), hourly('2026-11-30', 14, 17)], MON_SAT)
      ).toBeNull();
    });

    it('rejects Fri and Mon when Saturday is open', () => {
      expect(daysInARowViolation([fullDay('2026-11-27'), fullDay('2026-11-30')], MON_SAT)?.code).toBe(
        DAY_HOURS_CODES.NOT_IN_A_ROW
      );
    });

    it('rejects two blocks on the same day', () => {
      expect(
        daysInARowViolation([hourly('2026-11-27', 8, 10), hourly('2026-11-27', 14, 16)], MON_SAT)?.code
      ).toBe(DAY_HOURS_CODES.ONE_BLOCK_PER_DAY);
    });

    it('accepts a single day and ignores window order', () => {
      expect(daysInARowViolation([fullDay('2026-11-27')], MON_SAT)).toBeNull();
      expect(daysInARowViolation([fullDay('2026-11-28'), fullDay('2026-11-27')], MON_SAT)).toBeNull();
    });
  });

  describe('min and max hours per block', () => {
    it('rejects one short block even when the total meets the minimum', () => {
      expect(
        blockHoursViolation([hourly('2026-11-27', 8, 9), hourly('2026-11-28', 8, 9)], 2, null)?.code
      ).toBe(DAY_HOURS_CODES.BLOCK_BELOW_MIN);
    });

    it('lets two full days through an 8 h maximum', () => {
      expect(blockHoursViolation([fullDay('2026-11-27'), fullDay('2026-11-28')], 2, 8)).toBeNull();
    });

    it('rejects an hour block above the maximum', () => {
      expect(blockHoursViolation([hourly('2026-11-27', 8, 17)], 1, 8)?.code).toBe(
        DAY_HOURS_CODES.BLOCK_ABOVE_MAX
      );
    });
  });

  describe('lead time', () => {
    // 25 Nov 2026 09:20 UTC = 10:20 in Libreville (UTC+1).
    const now = Date.parse('2026-11-25T09:20:00.000Z');

    it('reads now as listing wall-clock time', () => {
      expect(new Date(wallClockNowMs(now, 'Africa/Libreville')).toISOString()).toBe('2026-11-25T10:20:00.000Z');
      expect(new Date(wallClockNowMs(now, 'America/Toronto')).toISOString()).toBe('2026-11-25T04:20:00.000Z');
    });

    it('accepts 13:00 and rejects 12:00 at 10:20 in Libreville', () => {
      expect(leadTimeViolation([hourly('2026-11-25', 13, 15)], now, 'Africa/Libreville')).toBeNull();
      expect(leadTimeViolation([hourly('2026-11-25', 12, 14)], now, 'Africa/Libreville')?.code).toBe(
        DAY_HOURS_CODES.LEAD_TIME
      );
    });

    it('keeps a 10-minute grace for time spent on the sheet', () => {
      const at = (hhmm: string): DayHoursWindow => ({
        start: new Date(`2026-11-25T${hhmm}:00.000Z`),
        end: new Date('2026-11-25T16:00:00.000Z'),
        billing: 'hourly',
      });
      // 10:20 + 2 h = 12:20, less 10 min grace = 12:10.
      expect(leadTimeViolation([at('12:15')], now, 'Africa/Libreville')).toBeNull();
      expect(leadTimeViolation([at('12:05')], now, 'Africa/Libreville')?.code).toBe(DAY_HOURS_CODES.LEAD_TIME);
    });
  });

  describe('listing modes', () => {
    it('rejects a full day on an hourly-only listing and hours on a daily-only one', () => {
      expect(modeViolation([fullDay('2026-11-27')], { offers_daily: false })?.code).toBe(
        DAY_HOURS_CODES.MODE_DAILY_OFF
      );
      expect(modeViolation([hourly('2026-11-27', 8, 10)], { offers_hourly: false })?.code).toBe(
        DAY_HOURS_CODES.MODE_HOURLY_OFF
      );
    });

    it('treats missing columns as both on', () => {
      expect(modeViolation([fullDay('2026-11-27'), hourly('2026-11-28', 8, 10)], {})).toBeNull();
    });

    it('needs one switch on and a price for each switch on', () => {
      expect(listingModesViolation({ offersHourly: false, offersDaily: false, hourPrice: 1, dayPrice: 1 })?.code).toBe(
        DAY_HOURS_CODES.LISTING_NEEDS_A_MODE
      );
      expect(listingModesViolation({ offersHourly: false, offersDaily: true, hourPrice: 0, dayPrice: 27000 })).toBeNull();
      expect(listingModesViolation({ offersHourly: true, offersDaily: false, hourPrice: 3000, dayPrice: 0 })).toBeNull();
      expect(listingModesViolation({ offersHourly: true, offersDaily: true, hourPrice: 3000, dayPrice: 0 })?.code).toBe(
        DAY_HOURS_CODES.LISTING_MODE_PRICE
      );
    });
  });

  it('runs lead time, days in a row, then block hours', () => {
    const now = Date.parse('2026-11-25T09:20:00.000Z');
    const run = (windows: DayHoursWindow[]) =>
      dayHoursPickerViolation({
        windows,
        listing: { weekly_availability: MON_SAT },
        minHours: 2,
        maxHours: 8,
        nowMs: now,
        timeZone: 'Africa/Libreville',
      })?.code ?? null;
    expect(run([fullDay('2026-11-27'), hourly('2026-11-28', 10, 13), hourly('2026-11-30', 14, 17)])).toBeNull();
    expect(run([hourly('2026-11-25', 11, 13)])).toBe(DAY_HOURS_CODES.LEAD_TIME);
    expect(run([fullDay('2026-11-27'), fullDay('2026-11-30')])).toBe(DAY_HOURS_CODES.NOT_IN_A_ROW);
    expect(run([hourly('2026-11-27', 8, 9)])).toBe(DAY_HOURS_CODES.BLOCK_BELOW_MIN);
  });
});
