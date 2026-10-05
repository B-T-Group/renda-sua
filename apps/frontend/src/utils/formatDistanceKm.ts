/** Kilometers for “x km from you”. Under 1 km keeps one decimal. */
export function formatDistanceKm(
  meters: number | null | undefined
): string | null {
  if (meters == null || !Number.isFinite(meters) || meters < 0) return null;
  if (meters < 1000) return (meters / 1000).toFixed(1);
  return Math.round(meters / 1000).toString();
}
