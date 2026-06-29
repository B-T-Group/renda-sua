export interface RegionAddressEntry {
  address: {
    country?: string | null;
    state?: string | null;
    is_primary?: boolean | null;
  } | null;
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

/** Haversine distance in kilometers. */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Whether the entity's primary address shares the given country and state. */
export function addressesMatchRegion(
  addresses: RegionAddressEntry[] | null | undefined,
  country?: string | null,
  state?: string | null
): boolean {
  const list = addresses ?? [];
  if (list.length === 0) return false;
  const primary = list.find((a) => a.address?.is_primary) ?? list[0];
  return primary.address?.country === country && primary.address?.state === state;
}
