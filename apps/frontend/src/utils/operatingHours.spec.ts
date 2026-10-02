import { DEFAULT_OPERATING_HOURS } from './operatingHours';
import {
  formatOperatingHoursSummary,
  isAllDaysClosed,
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
});
