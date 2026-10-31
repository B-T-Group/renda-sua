import { describe, expect, it } from 'vitest';
import { distanceKm } from './helpers';
import type { OrderLike } from './types';

function order(overrides: Partial<OrderLike> = {}): OrderLike {
  return {
    id: 'o1',
    order_number: 'RS-1',
    current_status: 'pending',
    ...overrides,
  } as OrderLike;
}

describe('distanceKm', () => {
  it('returns a number from numeric distance_km', () => {
    expect(distanceKm(order({ distance_km: 2.5 }))).toBe(2.5);
  });

  it('parses a numeric string from Hasura', () => {
    expect(
      distanceKm(order({ distance_km: '3.25' as unknown as number }))
    ).toBe(3.25);
  });

  it('falls back to pickup_distance_km', () => {
    expect(distanceKm(order({ pickup_distance_km: '1.5' as unknown as number }))).toBe(
      1.5
    );
  });

  it('returns null for null, undefined, and NaN', () => {
    expect(distanceKm(order({ distance_km: null }))).toBeNull();
    expect(distanceKm(order({}))).toBeNull();
    expect(distanceKm(order({ distance_km: Number.NaN }))).toBeNull();
  });
});
