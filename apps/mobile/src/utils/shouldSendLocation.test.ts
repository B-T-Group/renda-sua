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
  const slackMs = 60 * 1000;

  it('should return true when there is no previous location', () => {
    const result = shouldSendLocation(
      null,
      0,
      0,
      Date.now(),
      minDistanceM,
      heartbeatMs,
      slackMs,
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
      slackMs,
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
      slackMs,
      mockHaversineDistance
    );
    expect(result).toBe(false);
  });

  it('should return true when time threshold (heartbeat - slack) is met even if stationary', () => {
    const nowMs = 1000000;
    const prev = { lat: 0, lng: 0, timestampMs: nowMs - (11 * 60 * 1000) };
    const result = shouldSendLocation(
      prev,
      0,
      0,
      nowMs,
      minDistanceM,
      heartbeatMs,
      slackMs,
      mockHaversineDistance
    );
    expect(result).toBe(true);
  });

  it('should return true when exactly at effective threshold (heartbeat - slack)', () => {
    const nowMs = 1000000;
    const effectiveHeartbeatMs = heartbeatMs - slackMs;
    const prev = { lat: 0, lng: 0, timestampMs: nowMs - effectiveHeartbeatMs };
    const result = shouldSendLocation(
      prev,
      0,
      0,
      nowMs,
      minDistanceM,
      heartbeatMs,
      slackMs,
      mockHaversineDistance
    );
    expect(result).toBe(true);
  });

  it('should return false when just under effective threshold and stationary', () => {
    const nowMs = 1000000;
    const effectiveHeartbeatMs = heartbeatMs - slackMs;
    const prev = {
      lat: 0,
      lng: 0,
      timestampMs: nowMs - effectiveHeartbeatMs + 1000,
    };
    const result = shouldSendLocation(
      prev,
      0,
      0,
      nowMs,
      minDistanceM,
      heartbeatMs,
      slackMs,
      mockHaversineDistance
    );
    expect(result).toBe(false);
  });

  it('should handle timer jitter: 599.5s elapsed should send with 60s slack', () => {
    const nowMs = 1000000;
    const prev = { lat: 0, lng: 0, timestampMs: nowMs - 599500 };
    const result = shouldSendLocation(
      prev,
      0,
      0,
      nowMs,
      minDistanceM,
      heartbeatMs,
      slackMs,
      mockHaversineDistance
    );
    expect(result).toBe(true);
  });

  it('should handle timer jitter: 540.2s elapsed should send with 60s slack', () => {
    const nowMs = 1000000;
    const prev = { lat: 0, lng: 0, timestampMs: nowMs - 540200 };
    const result = shouldSendLocation(
      prev,
      0,
      0,
      nowMs,
      minDistanceM,
      heartbeatMs,
      slackMs,
      mockHaversineDistance
    );
    expect(result).toBe(true);
  });

  it('should return true when distance is exactly at threshold', () => {
    const nowMs = 1000000;
    const prev = { lat: 0, lng: 0, timestampMs: nowMs - 60000 };
    const lat2 = 0.0009;
    const lng2 = 0;
    const distance = mockHaversineDistance(0, 0, lat2, lng2);
    const result = shouldSendLocation(
      prev,
      lat2,
      lng2,
      nowMs,
      distance,
      heartbeatMs,
      slackMs,
      mockHaversineDistance
    );
    expect(result).toBe(true);
  });
});
