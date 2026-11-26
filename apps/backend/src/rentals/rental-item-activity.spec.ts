import {
  activityOrderForScope,
  activityPageLimit,
  activityStatusesForScope,
  defaultActivityScope,
  earnedFromCompletedSums,
  normalizeActivityScope,
} from './rental-item-activity';

describe('rental item activity helpers', () => {
  it('normalizes scope and falls back to all', () => {
    expect(normalizeActivityScope('upcoming')).toBe('upcoming');
    expect(normalizeActivityScope('PAST')).toBe('past');
    expect(normalizeActivityScope('weird')).toBe('all');
    expect(normalizeActivityScope(undefined)).toBe('all');
    expect(normalizeActivityScope(' Upcoming ')).toBe('upcoming');
    expect(normalizeActivityScope(null)).toBe('all');
    expect(normalizeActivityScope('')).toBe('all');
  });

  it('maps scopes to status filters and order', () => {
    expect(activityStatusesForScope('upcoming')).toEqual([
      'proposed',
      'reserved',
      'confirmed',
      'active',
      'awaiting_return',
    ]);
    expect(activityStatusesForScope('past')).toEqual(['completed', 'cancelled']);
    expect(activityStatusesForScope('all')).toBeNull();
    expect(activityOrderForScope('upcoming')).toEqual([{ start_at: 'asc' }]);
    expect(activityOrderForScope('past')).toEqual([{ start_at: 'desc' }]);
    expect(activityOrderForScope('all')).toEqual([{ start_at: 'desc' }]);
  });

  it('pages with safe defaults and caps', () => {
    expect(activityPageLimit(undefined, undefined)).toEqual({
      page: 1,
      limit: 20,
      offset: 0,
    });
    expect(activityPageLimit(2, 50)).toEqual({ page: 2, limit: 50, offset: 50 });
    expect(activityPageLimit(0, 999)).toEqual({ page: 1, limit: 100, offset: 0 });
    expect(activityPageLimit(-2, -5)).toEqual({ page: 1, limit: 1, offset: 0 });
    expect(activityPageLimit(Number.NaN, Number.NaN)).toEqual({ page: 1, limit: 20, offset: 0 });
    expect(activityPageLimit(3, 1)).toEqual({ page: 3, limit: 1, offset: 2 });
  });

  it('sums earned from completed amounts', () => {
    expect(earnedFromCompletedSums(100, 20)).toBe(120);
    expect(earnedFromCompletedSums(null, undefined)).toBe(0);
    expect(earnedFromCompletedSums('100.50' as unknown as number, '20.25' as unknown as number)).toBe(120.75);
    expect(earnedFromCompletedSums(100, -20)).toBe(80);
  });

  it('defaults the UI scope from counts', () => {
    expect(defaultActivityScope({ upcoming: 2, timesRented: 0 })).toBe('upcoming');
    expect(defaultActivityScope({ upcoming: 0, timesRented: 3 })).toBe('past');
    expect(defaultActivityScope({ upcoming: 0, timesRented: 0 })).toBe('all');
    expect(defaultActivityScope({ upcoming: 1, timesRented: 9 })).toBe('upcoming');
  });
});
