import { DEFAULT_OPERATING_HOURS } from './operatingHours';
import {
  copyMondayToOpenDays,
  editorHoursAreValid,
  editorValueToOperatingHours,
  formatOperatingHoursSummary,
  isAllDaysClosed,
  operatingHoursEqual,
  operatingHoursToEditorValue,
} from './operatingHours';

const t = (key: string, defaultValue: string) => defaultValue;

const everyDay = {
  monday: { open: '08:00', close: '20:00' },
  tuesday: { open: '08:00', close: '20:00' },
  wednesday: { open: '08:00', close: '20:00' },
  thursday: { open: '08:00', close: '20:00' },
  friday: { open: '08:00', close: '20:00' },
  saturday: { open: '08:00', close: '20:00' },
  sunday: { open: '08:00', close: '20:00' },
};

const allClosed = {
  monday: { closed: true },
  tuesday: { closed: true },
  wednesday: { closed: true },
  thursday: { closed: true },
  friday: { closed: true },
  saturday: { closed: true },
  sunday: { closed: true },
};

describe('formatOperatingHoursSummary', () => {
  it('summarizes weekday defaults', () => {
    expect(formatOperatingHoursSummary(DEFAULT_OPERATING_HOURS, t)).toBe(
      'Mon–Fri 08:00–20:00'
    );
  });

  it('summarizes every day', () => {
    expect(formatOperatingHoursSummary(everyDay, t)).toBe(
      'Every day 08:00–20:00'
    );
  });

  it('summarizes a custom window', () => {
    const hours = {
      ...DEFAULT_OPERATING_HOURS,
      monday: { open: '09:00', close: '17:00' },
    };
    expect(formatOperatingHoursSummary(hours, t)).toBe('Custom schedule');
  });

  it('returns closed when all days are closed', () => {
    expect(formatOperatingHoursSummary(allClosed, t)).toBe('Closed');
    expect(isAllDaysClosed(allClosed)).toBe(true);
    expect(isAllDaysClosed(DEFAULT_OPERATING_HOURS)).toBe(false);
  });

  it('uses the platform default when hours are missing, and a single open day', () => {
    expect(formatOperatingHoursSummary(null, t)).toBe('Mon–Fri 08:00–20:00');
    expect(formatOperatingHoursSummary({}, t)).toBe('Mon–Fri 08:00–20:00');
    expect(isAllDaysClosed(null)).toBe(false);
    expect(isAllDaysClosed({})).toBe(false);
    expect(
      formatOperatingHoursSummary(
        {
          monday: { open: '08:00', close: '20:00' },
          tuesday: { closed: true },
          wednesday: { closed: true },
          thursday: { closed: true },
          friday: { closed: true },
          saturday: { closed: true },
          sunday: { closed: true },
        },
        t
      )
    ).toBe('Mon 08:00–20:00');
  });

  it('counts non-consecutive days that share one window', () => {
    expect(
      formatOperatingHoursSummary(
        {
          monday: { open: '08:00', close: '20:00' },
          tuesday: { closed: true },
          wednesday: { open: '08:00', close: '20:00' },
          thursday: { closed: true },
          friday: { closed: true },
          saturday: { closed: true },
          sunday: { closed: true },
        },
        t
      )
    ).toBe('2 days · 08:00–20:00');
  });
});

describe('operatingHours editor conversion', () => {
  it('round-trips the platform default and an all-closed week', () => {
    expect(
      editorValueToOperatingHours(operatingHoursToEditorValue(null))
    ).toEqual(DEFAULT_OPERATING_HOURS);
    expect(
      editorValueToOperatingHours(operatingHoursToEditorValue(allClosed))
    ).toEqual(allClosed);
  });

  it('keeps an explicit window and treats omitted days as closed', () => {
    const value = operatingHoursToEditorValue({
      monday: { open: '09:00', close: '17:00' },
    });
    expect(value.monday).toEqual({
      enabled: true,
      start: '09:00',
      end: '17:00',
    });
    expect(value.tuesday.enabled).toBe(false);
    expect(value.saturday.enabled).toBe(false);
    expect(editorValueToOperatingHours(value).tuesday).toEqual({
      closed: true,
    });
  });

  it('rejects a close time that is not after open, including equal times', () => {
    const hours = operatingHoursToEditorValue(DEFAULT_OPERATING_HOURS);
    expect(editorHoursAreValid(hours)).toBe(true);
    expect(
      editorHoursAreValid({
        ...hours,
        monday: { enabled: true, start: '20:00', end: '08:00' },
      })
    ).toBe(false);
    expect(
      editorHoursAreValid({
        ...hours,
        monday: { enabled: true, start: '12:00', end: '12:00' },
      })
    ).toBe(false);
    expect(
      editorHoursAreValid({
        ...hours,
        saturday: { enabled: false, start: '20:00', end: '08:00' },
      })
    ).toBe(true);
  });

  it('copies Monday onto open days and leaves closed days alone', () => {
    const hours = operatingHoursToEditorValue({
      monday: { open: '09:00', close: '17:00' },
      tuesday: { open: '08:00', close: '20:00' },
      wednesday: { closed: true },
    });
    const mondayOff = {
      ...hours,
      monday: { ...hours.monday, enabled: false },
    };
    expect(copyMondayToOpenDays(mondayOff)).toBe(mondayOff);

    const next = copyMondayToOpenDays(hours);
    expect(next).not.toBe(hours);
    expect(next.tuesday).toEqual({
      enabled: true,
      start: '09:00',
      end: '17:00',
    });
    expect(next.wednesday.enabled).toBe(false);
    expect(hours.tuesday.start).toBe('08:00');
  });

  it('compares saved hours without treating missing as different', () => {
    expect(operatingHoursEqual(null, undefined)).toBe(true);
    expect(operatingHoursEqual(DEFAULT_OPERATING_HOURS, DEFAULT_OPERATING_HOURS)).toBe(
      true
    );
    expect(
      operatingHoursEqual(DEFAULT_OPERATING_HOURS, {
        ...DEFAULT_OPERATING_HOURS,
        monday: { open: '09:00', close: '17:00' },
      })
    ).toBe(false);
  });
});
