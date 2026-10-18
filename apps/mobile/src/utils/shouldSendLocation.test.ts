import { describe, it, expect } from 'vitest';
import { shouldSendLocation } from './shouldSendLocation';

const mockHaversineDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const latDiff = Math.abs(lat2 - lat1);
  const lonDiff = Math.abs(lon2 - lon1);
  return Math.sqrt(latDiff ** 2 + lonDiff ** 2) * 111000;
};

describe('shouldSendLocation', () => {
  const minDistanceM = 100;
  const heartbeatMs = 10 * 60 * 1000;

  it('should return true when there is no previous location', () => {
    const result = shouldSendLocation(
      null,
      0,
      0,
      Date.now(),
      minDistanceM,
      heartbeatMs,
      mockHaversineDistance
    );
    expect(result).toBe(true);
  });

  it('should return true when distance threshold is met', () => {
    const nowMs = 1000000;
    const prev = { lat: 0, lng: 0, timestampMs: nowMs - 60000 };
    const result = shouldSendLocation(
      prev,
      0.002,
      0.002,
      nowMs,
      minDistanceM,
      heartbeatMs,
      mockHaversineDistance
    );
    expect(result).toBe(true);
  });

  it('should return false when neither distance nor time threshold is met', () => {
    const nowMs = 1000000;
    const prev = { lat: 0, lng: 0, timestampMs: nowMs - 60000 };
    const result = shouldSendLocation(
      prev,
      0,
      0,
      nowMs,
      minDistanceM,
      heartbeatMs,
      mockHaversineDistance
    );
    expect(result).toBe(false);
  });

  it('should return true when time threshold (heartbeat) is met even if stationary', () => {
    const nowMs = 1000000;
    const prev = { lat: 0, lng: 0, timestampMs: nowMs - (11 * 60 * 1000) };
    const result = shouldSendLocation(
      prev,
      0,
      0,
      nowMs,
      minDistanceM,
      heartbeatMs,
      mockHaversineDistance
    );
    expect(result).toBe(true);
  });

  it('should return true when exactly at time threshold', () => {
    const nowMs = 1000000;
    const prev = { lat: 0, lng: 0, timestampMs: nowMs - heartbeatMs };
    const result = shouldSendLocation(
      prev,
      0,
      0,
      nowMs,
      minDistanceM,
      heartbeatMs,
      mockHaversineDistance
    );
    expect(result).toBe(true);
  });

  it('should return false when just under time threshold and stationary', () => {
    const nowMs = 1000000;
    const prev = {
      lat: 0,
      lng: 0,
      timestampMs: nowMs - heartbeatMs + 1000,
    };
    const result = shouldSendLocation(
      prev,
      0,
      0,
      nowMs,
      minDistanceM,
      heartbeatMs,
      mockHaversineDistance
    );
    expect(result).toBe(false);
  });
});
