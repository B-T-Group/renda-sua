/**
 * Determines whether a new location fix should be sent to the server.
 * 
 * Send if:
 * - Moved >= minDistanceM from the last sent location, OR
 * - >= (heartbeatMs - slackMs) have elapsed since the last successful send
 * 
 * The slack tolerance prevents timer jitter from aliasing the effective cadence to 2×heartbeat.
 * 
 * @param prev Last sent location (coords + timestamp) or null if none
 * @param newLat New latitude
 * @param newLng New longitude
 * @param nowMs Current time in milliseconds
 * @param minDistanceM Minimum distance threshold in meters
 * @param heartbeatMs Minimum time threshold in milliseconds
 * @param slackMs Slack tolerance in milliseconds (subtracted from heartbeat threshold)
 * @param haversineDistanceFn Distance calculation function (for testability)
 * @returns true if the location should be sent
 */
export function shouldSendLocation(
  prev: { lat: number; lng: number; timestampMs: number } | null,
  newLat: number,
  newLng: number,
  nowMs: number,
  minDistanceM: number,
  heartbeatMs: number,
  slackMs: number,
  haversineDistanceFn: (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) => number
): boolean {
  if (!prev) return true;

  const elapsedMs = nowMs - prev.timestampMs;
  if (elapsedMs < 0) return true;

  const effectiveHeartbeatMs = heartbeatMs - slackMs;
  if (elapsedMs >= effectiveHeartbeatMs) return true;

  const distanceM = haversineDistanceFn(prev.lat, prev.lng, newLat, newLng);
  return distanceM >= minDistanceM;
}
