import {
  editorValueToFoodSlots,
  foodSlotsHaveMultipleWindowsPerDay,
  foodSlotsToEditorValue,
} from './foodHoursEditor';

describe('foodSlotsToEditorValue', () => {
  it('disables every day when no hours are set', () => {
    const value = foodSlotsToEditorValue([]);
    expect(Object.values(value).every((day) => !day.enabled)).toBe(true);
  });

  it('maps Sunday-first slots onto Monday-first editor days', () => {
    const value = foodSlotsToEditorValue([
      { day_of_week: 0, start_time: '10:00:00', end_time: '14:00:00' },
      { day_of_week: 1, start_time: '12:30:00', end_time: '16:00:00' },
    ]);
    expect(value.sunday).toEqual({
      enabled: true,
      start: '10:00',
      end: '14:00',
    });
    expect(value.monday).toEqual({
      enabled: true,
      start: '12:30',
      end: '16:00',
    });
  });

  it('keeps only the earliest window when a day has several', () => {
    const value = foodSlotsToEditorValue([
      { day_of_week: 1, start_time: '18:00:00', end_time: '21:00:00' },
      { day_of_week: 1, start_time: '12:00:00', end_time: '14:00:00' },
    ]);
    expect(value.monday.start).toBe('12:00');
    expect(value.monday.end).toBe('14:00');
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

describe('editorValueToFoodSlots', () => {
  it('emits no slots when every day is off', () => {
    expect(editorValueToFoodSlots(foodSlotsToEditorValue([]))).toEqual([]);
  });

  it('emits Sunday-first day indexes for enabled days', () => {
    expect(
      editorValueToFoodSlots({
        monday: { enabled: true, start: '12:00', end: '15:00' },
        sunday: { enabled: true, start: '09:00', end: '11:00' },
        tuesday: { enabled: false, start: '08:00', end: '20:00' },
      })
    ).toEqual([
      { day_of_week: 1, start_time: '12:00', end_time: '15:00' },
      { day_of_week: 0, start_time: '09:00', end_time: '11:00' },
    ]);
  });
});
