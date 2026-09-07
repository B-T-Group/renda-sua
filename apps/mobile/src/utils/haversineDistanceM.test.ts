import { describe, expect, it } from 'vitest';
import { haversineDistanceM } from './haversineDistanceM';

describe('haversineDistanceM', () => {
  it('returns 0 for identical points', () => {
    expect(haversineDistanceM(45.5, -73.5, 45.5, -73.5)).toBe(0);
  });

  it('approximates known short distance', () => {
    const d = haversineDistanceM(48.8566, 2.3522, 48.8606, 2.3522);
    expect(d).toBeGreaterThan(400);
    expect(d).toBeLessThan(500);
  });
});
