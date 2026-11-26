import { describe, expect, it } from 'vitest';
import { searchRentAction } from './searchRentAction';

const range = { startDate: '2026-11-27', endDate: '2026-11-29', dayCount: 2 };

describe('searchRentAction', () => {
  it('never opens the old search date sheet when the day-and-hours picker is on', () => {
    expect(searchRentAction(null, true)).toBe('request');
    expect(searchRentAction(range, true)).toBe('request');
  });

  it('keeps the old flow when the picker is off', () => {
    expect(searchRentAction(null, false)).toBe('search-dates');
    expect(searchRentAction(range, false)).toBe('request');
  });
});
