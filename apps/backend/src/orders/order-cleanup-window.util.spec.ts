import {
  createDateTimeInTimezone,
  isOrderWindowStale,
  isWindowStale,
  parseSlotTime,
  resolveCleanupTimezone,
  resolveWindowEndUtc,
} from './order-cleanup-window.util';

describe('order-cleanup-window.util', () => {
  describe('parseSlotTime', () => {
    it('parses HH:MM and HH:MM:SS', () => {
      expect(parseSlotTime('18:30')).toEqual({ hours: 18, minutes: 30 });
      expect(parseSlotTime('09:05:00')).toEqual({ hours: 9, minutes: 5 });
    });

    it('rejects invalid times', () => {
      expect(parseSlotTime('25:00')).toBeNull();
      expect(parseSlotTime('bad')).toBeNull();
    });
  });

  describe('createDateTimeInTimezone', () => {
    it('converts local slot end to UTC', () => {
      const utc = createDateTimeInTimezone(
        '2026-08-01',
        18,
        0,
        'America/Toronto'
      );
      // EDT (UTC-4) in August
      expect(utc.toISOString()).toBe('2026-08-01T22:00:00.000Z');
    });
  });

  describe('resolveCleanupTimezone', () => {
    it('prefers client timezone', () => {
      expect(
        resolveCleanupTimezone({
          client: { user: { timezone: 'Africa/Douala' } },
        })
      ).toBe('Africa/Douala');
    });

    it('falls back to config then country', () => {
      expect(
        resolveCleanupTimezone(
          { delivery_address: { country: 'CA' } },
          'America/Toronto'
        )
      ).toBe('America/Toronto');
      expect(
        resolveCleanupTimezone({ delivery_address: { country: 'CA' } })
      ).toBe('America/Toronto');
    });
  });

  describe('resolveWindowEndUtc / isWindowStale', () => {
    it('uses pickup_by when present', () => {
      const end = resolveWindowEndUtc(
        { pickup_by: '2026-08-01T22:00:00.000Z' },
        'UTC'
      );
      expect(end?.toISOString()).toBe('2026-08-01T22:00:00.000Z');
    });

    it('uses delivery window when pickup_by missing', () => {
      const end = resolveWindowEndUtc(
        {
          delivery_time_window: {
            preferred_date: '2026-08-01',
            time_slot_end: '18:00:00',
          },
        },
        'UTC'
      );
      expect(end?.toISOString()).toBe('2026-08-01T18:00:00.000Z');
    });

    it('returns null without window data', () => {
      expect(resolveWindowEndUtc({}, 'UTC')).toBeNull();
    });

    it('isWindowStale after grace', () => {
      const end = new Date('2026-08-01T18:00:00.000Z');
      expect(isWindowStale(end, 24, new Date('2026-08-02T17:59:00.000Z'))).toBe(
        false
      );
      expect(isWindowStale(end, 24, new Date('2026-08-02T18:00:01.000Z'))).toBe(
        true
      );
    });

    it('isOrderWindowStale integrates timezone + grace', () => {
      const order = {
        delivery_time_window: {
          preferred_date: '2026-08-01',
          time_slot_end: '12:00',
        },
      };
      expect(
        isOrderWindowStale(
          order,
          24,
          'UTC',
          new Date('2026-08-02T12:00:01.000Z')
        )
      ).toBe(true);
      expect(
        isOrderWindowStale(
          order,
          24,
          'UTC',
          new Date('2026-08-02T11:59:00.000Z')
        )
      ).toBe(false);
    });
  });
});
