import { describe, expect, it } from 'vitest';
import {
  weeklyTimeInputToStorage,
  weeklyTimeStorageToInput,
} from './weeklyTimeInput';

describe('weeklyTimeInputToStorage', () => {
  it('parses valid HH:MM into HH:MM:SS', () => {
    expect(weeklyTimeInputToStorage('08:30')).toBe('08:30:00');
    expect(weeklyTimeInputToStorage('9:05')).toBe('09:05:00');
  });

  it('rejects partial or invalid input', () => {
    expect(weeklyTimeInputToStorage('08:3')).toBeNull();
    expect(weeklyTimeInputToStorage('08:300')).toBeNull();
    expect(weeklyTimeInputToStorage('')).toBeNull();
  });

  it('clamps hours and minutes', () => {
    expect(weeklyTimeInputToStorage('25:00')).toBe('23:00:00');
    expect(weeklyTimeInputToStorage('08:99')).toBe('08:59:00');
  });
});

describe('weeklyTimeStorageToInput', () => {
  it('formats stored values for display', () => {
    expect(weeklyTimeStorageToInput('08:30:00')).toBe('08:30');
    expect(weeklyTimeStorageToInput(null)).toBe('');
  });
});
