/**
 * Determines whether a new location fix should be sent to the server.
 * 
 * Send if:
 * - Moved >= minDistanceM from the last sent location, OR
 * - >= heartbeatMs have elapsed since the last successful send
 * 
 * @param prev Last sent location (coords + timestamp) or null if none
 * @param newLat New latitude
 * @param newLng New longitude
 * @param nowMs Current time in milliseconds
 * @param minDistanceM Minimum distance threshold in meters
 * @param heartbeatMs Minimum time threshold in milliseconds
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
  haversineDistanceFn: (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) => number
): boolean {
  if (!prev) return true;

  const elapsedMs = nowMs - prev.timestampMs;
  if (elapsedMs >= heartbeatMs) return true;

  const distanceM = haversineDistanceFn(prev.lat, prev.lng, newLat, newLng);
  return distanceM >= minDistanceM;
}
