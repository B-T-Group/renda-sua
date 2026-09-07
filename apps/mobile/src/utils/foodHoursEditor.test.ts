import { describe, expect, it } from 'vitest';
import {
  editorRowsToFoodSlots,
  foodSlotsHaveMultipleWindowsPerDay,
  foodSlotsToEditorRows,
} from './foodHoursEditor';

describe('foodSlotsToEditorRows', () => {
  it('disables every day when no hours are set', () => {
    const rows = foodSlotsToEditorRows([]);
    expect(rows.every((row) => !row.enabled)).toBe(true);
    expect(rows.map((row) => row.day)).toEqual([
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ]);
  });

  it('maps Sunday-first slots onto Monday-first editor rows', () => {
    const rows = foodSlotsToEditorRows([
      { day_of_week: 0, start_time: '10:00:00', end_time: '14:00:00' },
      { day_of_week: 1, start_time: '12:30:00', end_time: '16:00:00' },
    ]);
    const sunday = rows.find((row) => row.day === 'sunday');
    const monday = rows.find((row) => row.day === 'monday');
    expect(sunday).toEqual({
      day: 'sunday',
      enabled: true,
      open: '10:00',
      close: '14:00',
    });
    expect(monday).toEqual({
      day: 'monday',
      enabled: true,
      open: '12:30',
      close: '16:00',
    });
  });

  it('keeps only the earliest window when a day has several', () => {
    const monday = foodSlotsToEditorRows([
      { day_of_week: 1, start_time: '18:00:00', end_time: '21:00:00' },
      { day_of_week: 1, start_time: '12:00:00', end_time: '14:00:00' },
    ]).find((row) => row.day === 'monday');
    expect(monday?.open).toBe('12:00');
    expect(monday?.close).toBe('14:00');
  });
});

describe('foodSlotsHaveMultipleWindowsPerDay', () => {
  it('is false for one window per day', () => {
    expect(
      foodSlotsHaveMultipleWindowsPerDay([
        { day_of_week: 1, start_time: '12:00', end_time: '14:00' },
      ])
    ).toBe(false);
  });

  it('is true when a day has several windows', () => {
    expect(
      foodSlotsHaveMultipleWindowsPerDay([
        { day_of_week: 1, start_time: '12:00', end_time: '14:00' },
        { day_of_week: 1, start_time: '18:00', end_time: '21:00' },
      ])
    ).toBe(true);
  });
});

describe('editorRowsToFoodSlots', () => {
  it('emits no slots when every day is off', () => {
    expect(
      editorRowsToFoodSlots(foodSlotsToEditorRows([]))
    ).toEqual([]);
  });

  it('emits Sunday-first day indexes for enabled days', () => {
    const slots = editorRowsToFoodSlots([
      { day: 'monday', enabled: true, open: '12:00', close: '15:00' },
      { day: 'sunday', enabled: true, open: '09:00', close: '11:00' },
      { day: 'tuesday', enabled: false, open: '08:00', close: '20:00' },
    ]);
    expect(slots).toEqual([
      { day_of_week: 1, start_time: '12:00', end_time: '15:00' },
      { day_of_week: 0, start_time: '09:00', end_time: '11:00' },
    ]);
  });
});
