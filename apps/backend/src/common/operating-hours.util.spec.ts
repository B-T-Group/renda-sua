import {
  DEFAULT_OPERATING_HOURS,
  getDayHours,
  getDayNameForIndex,
  isSlotFullyWithinHours,
  isTimeOfDayWithinHours,
  normalizeOperatingHours,
  parseTimeToMinutes,
} from './operating-hours.util';

describe('operating-hours.util', () => {
  it('maps JS day index to canonical day names', () => {
    expect(getDayNameForIndex(0)).toBe('sunday');
    expect(getDayNameForIndex(1)).toBe('monday');
    expect(getDayNameForIndex(6)).toBe('saturday');
  });

  it('parses HH:mm into minutes since midnight', () => {
    expect(parseTimeToMinutes('08:00')).toBe(480);
    expect(parseTimeToMinutes('20:30')).toBe(1230);
    expect(parseTimeToMinutes('bad')).toBeNull();
    expect(parseTimeToMinutes(undefined)).toBeNull();
  });

  it('normalizes full day name + open/close shape', () => {
    const normalized = normalizeOperatingHours({
      monday: { open: '08:00', close: '18:00' },
      sunday: { closed: true },
    });
    expect(normalized?.monday).toEqual({
      closed: false,
      open: '08:00',
      close: '18:00',
    });
    expect(normalized?.sunday).toEqual({ closed: true });
  });

  it('normalizes legacy 3-letter keys and start/end/enabled shape', () => {
    const normalized = normalizeOperatingHours({
      mon: { start: '08:00', end: '20:00', enabled: true },
      sun: { start: '10:00', end: '16:00', enabled: false },
    });
    expect(normalized?.monday).toEqual({
      closed: false,
      open: '08:00',
      close: '20:00',
    });
    expect(normalized?.sunday).toEqual({ closed: true });
  });

  it('normalizes literal "closed" string values', () => {
    const normalized = normalizeOperatingHours({
      sunday: { open: 'closed', close: 'closed' },
    });
    expect(normalized?.sunday).toEqual({ closed: true });
  });

  it('returns null for invalid input', () => {
    expect(normalizeOperatingHours(null)).toBeNull();
    expect(normalizeOperatingHours('not an object')).toBeNull();
    expect(normalizeOperatingHours({})).toBeNull();
  });

  it('DEFAULT_OPERATING_HOURS is Mon-Fri 08:00-20:00, Sat/Sun closed', () => {
    expect(DEFAULT_OPERATING_HOURS.monday).toEqual({
      closed: false,
      open: '08:00',
      close: '20:00',
    });
    expect(DEFAULT_OPERATING_HOURS.saturday).toEqual({ closed: true });
    expect(DEFAULT_OPERATING_HOURS.sunday).toEqual({ closed: true });
  });

  describe('isTimeOfDayWithinHours', () => {
    it('treats missing day hours as open', () => {
      expect(isTimeOfDayWithinHours(null, 720)).toBe(true);
    });

    it('respects closed flag', () => {
      expect(isTimeOfDayWithinHours({ closed: true }, 720)).toBe(false);
    });

    it('checks minute-of-day against open/close window', () => {
      const day = { closed: false, open: '09:00', close: '17:00' };
      expect(isTimeOfDayWithinHours(day, 720)).toBe(true); // noon
      expect(isTimeOfDayWithinHours(day, 480)).toBe(false); // 08:00
      expect(isTimeOfDayWithinHours(day, 1020)).toBe(false); // 17:00
    });

    it('supports overnight wrap-around windows', () => {
      const day = { closed: false, open: '20:00', close: '02:00' };
      expect(isTimeOfDayWithinHours(day, 23 * 60)).toBe(true); // 23:00
      expect(isTimeOfDayWithinHours(day, 60)).toBe(true); // 01:00
      expect(isTimeOfDayWithinHours(day, 12 * 60)).toBe(false); // noon
    });
  });

  describe('getDayHours', () => {
    it('returns the entry for the requested day or null', () => {
      const hours = normalizeOperatingHours({
        monday: { open: '08:00', close: '18:00' },
      });
      expect(getDayHours(hours, 'monday')).toEqual({
        closed: false,
        open: '08:00',
        close: '18:00',
      });
      expect(getDayHours(hours, 'tuesday')).toBeNull();
      expect(getDayHours(null, 'monday')).toBeNull();
    });
  });

  describe('isSlotFullyWithinHours', () => {
    const openDay = { closed: false, open: '08:00', close: '20:00' };

    it('treats missing day hours as open (no restriction)', () => {
      expect(isSlotFullyWithinHours(null, '08:00', '12:00')).toBe(true);
    });

    it('rejects any slot on a closed day', () => {
      expect(
        isSlotFullyWithinHours({ closed: true }, '08:00', '12:00')
      ).toBe(false);
    });

    it('accepts a slot fully contained within open hours', () => {
      expect(isSlotFullyWithinHours(openDay, '12:00', '16:00')).toBe(true);
    });

    it('rejects a slot that starts before opening', () => {
      const day = { closed: false, open: '09:00', close: '20:00' };
      expect(isSlotFullyWithinHours(day, '08:00', '12:00')).toBe(false);
    });

    it('rejects a slot that ends after closing', () => {
      const day = { closed: false, open: '08:00', close: '17:00' };
      expect(isSlotFullyWithinHours(day, '16:00', '20:00')).toBe(false);
    });

    it('accepts a slot exactly matching the open window', () => {
      expect(isSlotFullyWithinHours(openDay, '08:00', '20:00')).toBe(true);
    });
  });
});
