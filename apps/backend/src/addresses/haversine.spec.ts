import { haversineMeters } from './haversine';

const EARTH_RADIUS_METERS = 6_371_000;

describe('haversineMeters', () => {
  it('is zero for the same point and symmetric', () => {
    expect(haversineMeters(3.848, 11.502, 3.848, 11.502)).toBe(0);
    const outbound = haversineMeters(3.848, 11.502, 4.05, 9.7);
    expect(haversineMeters(4.05, 9.7, 3.848, 11.502)).toBe(outbound);
  });

  it('measures one degree of latitude as the earth radius in radians', () => {
    const expected = (Math.PI / 180) * EARTH_RADIUS_METERS;
    expect(haversineMeters(0, 0, 1, 0)).toBeCloseTo(expected, 5);
  });

  it('measures a 75 meter step north as 75 meters', () => {
    const delta = (75 / EARTH_RADIUS_METERS) * (180 / Math.PI);
    expect(haversineMeters(3.848, 11.502, 3.848 + delta, 11.502)).toBeCloseTo(75, 6);
  });

  it('stays finite at the opposite side of the earth', () => {
    const half = Math.PI * EARTH_RADIUS_METERS;
    expect(haversineMeters(0, 0, 0, 180)).toBeCloseTo(half, 4);
    expect(Number.isFinite(haversineMeters(0, 0, 0, 180))).toBe(true);
  });
});
