import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OPERATING_HOURS,
  applyHoursToEnabledDays,
  editorRowsToOperatingHours,
  formatOperatingHoursSummary,
  isValidOpenCloseWindow,
  operatingHoursToEditorRows,
} from './operatingHours';

const t = (key: string, defaultValue: string) => defaultValue;

describe('operatingHoursToEditorRows', () => {
  it('uses defaults when hours are null', () => {
    const rows = operatingHoursToEditorRows(null);
    expect(rows).toHaveLength(7);
    expect(rows[0]).toMatchObject({
      day: 'monday',
      enabled: true,
      open: '08:00',
      close: '20:00',
    });
    expect(rows[5]).toMatchObject({ day: 'saturday', enabled: false });
  });

  it('maps closed days and open windows', () => {
    const rows = operatingHoursToEditorRows({
      monday: { open: '09:00', close: '17:00' },
      tuesday: { closed: true },
    });
    expect(rows.find((r) => r.day === 'monday')).toMatchObject({
      enabled: true,
      open: '09:00',
      close: '17:00',
    });
    expect(rows.find((r) => r.day === 'tuesday')?.enabled).toBe(false);
  });

  it('fills missing days from platform defaults', () => {
    const rows = operatingHoursToEditorRows({
      monday: { open: '09:00', close: '17:00' },
    });
    expect(rows.find((r) => r.day === 'monday')).toMatchObject({
      enabled: true,
      open: '09:00',
      close: '17:00',
    });
    expect(rows.find((r) => r.day === 'tuesday')).toMatchObject({
      enabled: true,
      open: '08:00',
      close: '20:00',
    });
    expect(rows.find((r) => r.day === 'saturday')?.enabled).toBe(false);
  });
});

describe('editorRowsToOperatingHours', () => {
  it('round-trips default hours', () => {
    const rows = operatingHoursToEditorRows(DEFAULT_OPERATING_HOURS);
    expect(editorRowsToOperatingHours(rows)).toEqual(DEFAULT_OPERATING_HOURS);
  });
});

describe('formatOperatingHoursSummary', () => {
  it('summarizes weekday defaults', () => {
    expect(formatOperatingHoursSummary(DEFAULT_OPERATING_HOURS, t)).toBe(
      'Mon–Fri 08:00–20:00'
    );
  });

  it('summarizes every day', () => {
    const hours = {
      monday: { open: '08:00', close: '20:00' },
      tuesday: { open: '08:00', close: '20:00' },
      wednesday: { open: '08:00', close: '20:00' },
      thursday: { open: '08:00', close: '20:00' },
      friday: { open: '08:00', close: '20:00' },
      saturday: { open: '08:00', close: '20:00' },
      sunday: { open: '08:00', close: '20:00' },
    };
    expect(formatOperatingHoursSummary(hours, t)).toBe('Every day 08:00–20:00');
  });

  it('returns closed when all days are closed', () => {
    const hours = {
      monday: { closed: true },
      tuesday: { closed: true },
      wednesday: { closed: true },
      thursday: { closed: true },
      friday: { closed: true },
      saturday: { closed: true },
      sunday: { closed: true },
    };
    expect(formatOperatingHoursSummary(hours, t)).toBe('Closed');
  });
});

describe('applyHoursToEnabledDays', () => {
  it('copies source hours onto every enabled day', () => {
    const rows = operatingHoursToEditorRows({
      monday: { open: '09:00', close: '17:00' },
      tuesday: { open: '08:00', close: '20:00' },
      wednesday: { closed: true },
    });
    const next = applyHoursToEnabledDays(rows, 'monday');
    expect(next.find((r) => r.day === 'tuesday')).toMatchObject({
      enabled: true,
      open: '09:00',
      close: '17:00',
    });
    expect(next.find((r) => r.day === 'wednesday')?.enabled).toBe(false);
  });
});

describe('isValidOpenCloseWindow', () => {
  it('requires close after open', () => {
    expect(isValidOpenCloseWindow('08:00', '20:00')).toBe(true);
    expect(isValidOpenCloseWindow('20:00', '08:00')).toBe(false);
    expect(isValidOpenCloseWindow('12:00', '12:00')).toBe(false);
  });
});
