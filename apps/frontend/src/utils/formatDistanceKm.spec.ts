import { formatDistanceKm } from './formatDistanceKm';

describe('formatDistanceKm', () => {
  it('keeps one decimal under 1 km', () => {
    expect(formatDistanceKm(450)).toBe('0.5');
  });

  it('rounds at 1 km and above', () => {
    expect(formatDistanceKm(1400)).toBe('1');
    expect(formatDistanceKm(2600)).toBe('3');
  });

  it('returns null when distance is missing', () => {
    expect(formatDistanceKm(null)).toBeNull();
    expect(formatDistanceKm(undefined)).toBeNull();
  });
});
