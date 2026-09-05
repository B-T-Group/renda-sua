import {
  FoodAvailabilitySlot,
  minutesUntilFoodWindowCloses,
  resolveFoodAvailability,
} from './food-availability.util';

const TIMEZONE = 'Africa/Douala'; // UTC+1, no DST

/** 2026-08-24 is a Monday. */
function douala(iso: string): Date {
  return new Date(`${iso}+01:00`);
}

const MONDAY_LUNCH: FoodAvailabilitySlot = {
  day_of_week: 1,
  start_time: '12:30:00',
  end_time: '16:00:00',
};

const FRIDAY_NIGHT: FoodAvailabilitySlot = {
  day_of_week: 5,
  start_time: '20:00:00',
  end_time: '02:00:00',
};

describe('resolveFoodAvailability', () => {
  describe('with no schedule configured', () => {
    it('treats the dish as always available', () => {
      const actual = resolveFoodAvailability({
        slots: [],
        now: douala('2026-08-24T03:00:00'),
        timezone: TIMEZONE,
      });

      expect(actual.hasSchedule).toBe(false);
      expect(actual.isOpenNow).toBe(true);
      expect(actual.isAvailableNow).toBe(true);
      expect(actual.nextOpeningAt).toBeNull();
    });

    it('still honours the sold-out flag set the same day', () => {
      const actual = resolveFoodAvailability({
        slots: [],
        markedUnavailableAt: douala('2026-08-24T09:00:00').toISOString(),
        now: douala('2026-08-24T13:00:00'),
        timezone: TIMEZONE,
      });

      expect(actual.isMarkedUnavailableToday).toBe(true);
      expect(actual.isAvailableNow).toBe(false);
    });
  });

  describe('same-day windows', () => {
    it('is open inside the window', () => {
      const actual = resolveFoodAvailability({
        slots: [MONDAY_LUNCH],
        now: douala('2026-08-24T13:00:00'),
        timezone: TIMEZONE,
      });

      expect(actual.isOpenNow).toBe(true);
      expect(actual.isAvailableNow).toBe(true);
    });

    it('is closed before the window opens', () => {
      const actual = resolveFoodAvailability({
        slots: [MONDAY_LUNCH],
        now: douala('2026-08-24T11:00:00'),
        timezone: TIMEZONE,
      });

      expect(actual.isOpenNow).toBe(false);
      expect(actual.nextOpeningAt?.toISOString()).toBe(
        douala('2026-08-24T12:30:00').toISOString()
      );
    });

    it('is closed at the exact end of the window', () => {
      const actual = resolveFoodAvailability({
        slots: [MONDAY_LUNCH],
        now: douala('2026-08-24T16:00:00'),
        timezone: TIMEZONE,
      });

      expect(actual.isOpenNow).toBe(false);
    });

    it('is open at the exact start of the window', () => {
      const actual = resolveFoodAvailability({
        slots: [MONDAY_LUNCH],
        now: douala('2026-08-24T12:30:00'),
        timezone: TIMEZONE,
      });

      expect(actual.isOpenNow).toBe(true);
    });

    it('is closed on a day with no window', () => {
      const actual = resolveFoodAvailability({
        slots: [MONDAY_LUNCH],
        now: douala('2026-08-25T13:00:00'), // Tuesday
        timezone: TIMEZONE,
      });

      expect(actual.isOpenNow).toBe(false);
      expect(actual.nextOpeningAt?.toISOString()).toBe(
        douala('2026-08-31T12:30:00').toISOString() // next Monday
      );
    });
  });

  describe('windows running past midnight', () => {
    it('is open late on the starting day', () => {
      const actual = resolveFoodAvailability({
        slots: [FRIDAY_NIGHT],
        now: douala('2026-08-28T23:30:00'), // Friday
        timezone: TIMEZONE,
      });

      expect(actual.isOpenNow).toBe(true);
    });

    it('is still open after midnight on the following day', () => {
      const actual = resolveFoodAvailability({
        slots: [FRIDAY_NIGHT],
        now: douala('2026-08-29T01:30:00'), // Saturday 01:30
        timezone: TIMEZONE,
      });

      expect(actual.isOpenNow).toBe(true);
    });

    it('closes when the overnight tail ends', () => {
      const actual = resolveFoodAvailability({
        slots: [FRIDAY_NIGHT],
        now: douala('2026-08-29T02:00:00'),
        timezone: TIMEZONE,
      });

      expect(actual.isOpenNow).toBe(false);
    });

    it('is closed on Friday afternoon before the window', () => {
      const actual = resolveFoodAvailability({
        slots: [FRIDAY_NIGHT],
        now: douala('2026-08-28T18:00:00'),
        timezone: TIMEZONE,
      });

      expect(actual.isOpenNow).toBe(false);
      expect(actual.nextOpeningAt?.toISOString()).toBe(
        douala('2026-08-28T20:00:00').toISOString()
      );
    });
  });

  describe('sold-out flag lifetime', () => {
    it('applies for the rest of the day across separate windows', () => {
      const dinner: FoodAvailabilitySlot = {
        day_of_week: 1,
        start_time: '18:00:00',
        end_time: '21:00:00',
      };

      const actual = resolveFoodAvailability({
        slots: [MONDAY_LUNCH, dinner],
        markedUnavailableAt: douala('2026-08-24T13:00:00').toISOString(),
        now: douala('2026-08-24T19:00:00'),
        timezone: TIMEZONE,
      });

      expect(actual.isOpenNow).toBe(true);
      expect(actual.isMarkedUnavailableToday).toBe(true);
      expect(actual.isAvailableNow).toBe(false);
    });

    it('resets on the next day the dish is available', () => {
      const actual = resolveFoodAvailability({
        slots: [MONDAY_LUNCH],
        markedUnavailableAt: douala('2026-08-24T13:00:00').toISOString(),
        now: douala('2026-08-31T13:00:00'), // the following Monday
        timezone: TIMEZONE,
      });

      expect(actual.isMarkedUnavailableToday).toBe(false);
      expect(actual.isAvailableNow).toBe(true);
    });

    it('survives midnight inside a window that started the previous day', () => {
      const actual = resolveFoodAvailability({
        slots: [FRIDAY_NIGHT],
        markedUnavailableAt: douala('2026-08-28T23:00:00').toISOString(),
        now: douala('2026-08-29T01:00:00'),
        timezone: TIMEZONE,
      });

      expect(actual.isOpenNow).toBe(true);
      expect(actual.isMarkedUnavailableToday).toBe(true);
      expect(actual.isAvailableNow).toBe(false);
    });

    it('clears once the overnight window rolls round again', () => {
      const actual = resolveFoodAvailability({
        slots: [FRIDAY_NIGHT],
        markedUnavailableAt: douala('2026-08-28T23:00:00').toISOString(),
        now: douala('2026-09-04T20:30:00'), // the following Friday
        timezone: TIMEZONE,
      });

      expect(actual.isMarkedUnavailableToday).toBe(false);
      expect(actual.isAvailableNow).toBe(true);
    });

    it('does not pin an after-midnight sold-out stamp to the new calendar day', () => {
      const saturdayNight: FoodAvailabilitySlot = {
        day_of_week: 6,
        start_time: '20:00:00',
        end_time: '02:00:00',
      };
      const saturdayLunch: FoodAvailabilitySlot = {
        day_of_week: 6,
        start_time: '12:00:00',
        end_time: '15:00:00',
      };

      const lunch = resolveFoodAvailability({
        slots: [FRIDAY_NIGHT, saturdayLunch],
        markedUnavailableAt: douala('2026-08-29T01:30:00').toISOString(),
        now: douala('2026-08-29T13:00:00'),
        timezone: TIMEZONE,
      });
      expect(lunch.isOpenNow).toBe(true);
      expect(lunch.isMarkedUnavailableToday).toBe(false);
      expect(lunch.isAvailableNow).toBe(true);

      const evening = resolveFoodAvailability({
        slots: [FRIDAY_NIGHT, saturdayNight],
        markedUnavailableAt: douala('2026-08-29T01:30:00').toISOString(),
        now: douala('2026-08-29T20:30:00'),
        timezone: TIMEZONE,
      });
      expect(evening.isOpenNow).toBe(true);
      expect(evening.isMarkedUnavailableToday).toBe(false);
      expect(evening.isAvailableNow).toBe(true);
    });

    it('keeps an after-midnight sold-out stamp while the overnight tail is open', () => {
      const actual = resolveFoodAvailability({
        slots: [FRIDAY_NIGHT],
        markedUnavailableAt: douala('2026-08-29T01:30:00').toISOString(),
        now: douala('2026-08-29T01:45:00'),
        timezone: TIMEZONE,
      });

      expect(actual.isOpenNow).toBe(true);
      expect(actual.isMarkedUnavailableToday).toBe(true);
      expect(actual.isAvailableNow).toBe(false);
    });
  });

  describe('timezone handling', () => {
    it('uses the location timezone rather than UTC', () => {
      // 23:30 UTC is 00:30 the next day in Douala, so Monday lunch has not started.
      const actual = resolveFoodAvailability({
        slots: [MONDAY_LUNCH],
        now: new Date('2026-08-24T11:45:00Z'), // 12:45 in Douala
        timezone: TIMEZONE,
      });

      expect(actual.isOpenNow).toBe(true);
    });

    it('respects a different location timezone for the same instant', () => {
      const actual = resolveFoodAvailability({
        slots: [MONDAY_LUNCH],
        now: new Date('2026-08-24T11:45:00Z'), // 07:45 in Toronto
        timezone: 'America/Toronto',
      });

      expect(actual.isOpenNow).toBe(false);
    });
  });

  describe('invalid slot data', () => {
    it('ignores unparseable and zero-length windows', () => {
      const actual = resolveFoodAvailability({
        slots: [
          { day_of_week: 1, start_time: 'nonsense', end_time: '16:00:00' },
          { day_of_week: 1, start_time: '10:00:00', end_time: '10:00:00' },
          { day_of_week: 9, start_time: '10:00:00', end_time: '11:00:00' },
        ],
        now: douala('2026-08-24T10:30:00'),
        timezone: TIMEZONE,
      });

      expect(actual.hasSchedule).toBe(false);
      expect(actual.isOpenNow).toBe(true);
    });
  });
});

describe('minutesUntilFoodWindowCloses', () => {
  it('returns null when no schedule is configured', () => {
    expect(
      minutesUntilFoodWindowCloses({
        slots: [],
        now: douala('2026-08-24T13:00:00'),
        timezone: TIMEZONE,
      })
    ).toBeNull();
  });

  it('counts minutes to the end of a same-day window', () => {
    expect(
      minutesUntilFoodWindowCloses({
        slots: [MONDAY_LUNCH],
        now: douala('2026-08-24T15:30:00'),
        timezone: TIMEZONE,
      })
    ).toBe(30);
  });

  it('counts minutes across midnight', () => {
    expect(
      minutesUntilFoodWindowCloses({
        slots: [FRIDAY_NIGHT],
        now: douala('2026-08-28T23:30:00'),
        timezone: TIMEZONE,
      })
    ).toBe(150);
  });

  it('returns null when closed', () => {
    expect(
      minutesUntilFoodWindowCloses({
        slots: [MONDAY_LUNCH],
        now: douala('2026-08-24T17:00:00'),
        timezone: TIMEZONE,
      })
    ).toBeNull();
  });
});
