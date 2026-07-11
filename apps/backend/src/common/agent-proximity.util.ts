export interface RegionAddressEntry {
  address: {
    country?: string | null;
    state?: string | null;
    is_primary?: boolean | null;
  } | null;
}

export interface AgentOperatingRegion {
  country: string;
  state: string;
}

export type ReverseGeocodeFn = (
  lat: number,
  lng: number
) => Promise<{ country: string; state: string }>;

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

/** Country from profile addresses (state optional — supports country-only signup seed). */
export function countryFromAddresses(
  addresses: RegionAddressEntry[] | null | undefined
): string | null {
  const list = addresses ?? [];
  if (list.length === 0) return null;
  const primary = list.find((a) => a.address?.is_primary) ?? list[0];
  const country = primary.address?.country?.trim();
  return country || null;
}

/** Country/state from profile addresses when available. */
export function regionFromAddresses(
  addresses: RegionAddressEntry[] | null | undefined
): AgentOperatingRegion | null {
  const list = addresses ?? [];
  if (list.length === 0) return null;
  const primary = list.find((a) => a.address?.is_primary) ?? list[0];
  const country = primary.address?.country;
  const state = primary.address?.state;
  if (!country || !state) return null;
  return { country, state };
}

/** Profile address country first; else reverse-geocode GPS country only. */
export async function resolveAgentPreviewCountry(params: {
  agentAddresses: RegionAddressEntry[] | null | undefined;
  agentLocation?: { latitude: number; longitude: number } | null;
  reverseGeocode?: ReverseGeocodeFn;
}): Promise<string | null> {
  const fromAddress = countryFromAddresses(params.agentAddresses);
  if (fromAddress) return fromAddress;

  const loc = params.agentLocation;
  if (!loc || !params.reverseGeocode) return null;

  try {
    const geo = await params.reverseGeocode(loc.latitude, loc.longitude);
    return geo.country?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Full country+state from profile address when present.
 * If address is missing or country-only (no state), reverse-geocode agent_location.
 */
export async function resolveAgentOperatingRegion(params: {
  agentAddresses: RegionAddressEntry[] | null | undefined;
  agentLocation?: { latitude: number; longitude: number } | null;
  reverseGeocode?: ReverseGeocodeFn;
}): Promise<AgentOperatingRegion | null> {
  const fromAddress = regionFromAddresses(params.agentAddresses);
  if (fromAddress) return fromAddress;

  const loc = params.agentLocation;
  if (!loc || !params.reverseGeocode) return null;

  try {
    const geo = await params.reverseGeocode(loc.latitude, loc.longitude);
    const geoCountry = geo.country?.trim();
    const geoState = geo.state?.trim();
    if (!geoCountry || !geoState) return null;
    return { country: geoCountry, state: geoState };
  } catch {
    return null;
  }
}

/** Whether the entity's primary address shares the given country and state. */
export function addressesMatchRegion(
  addresses: RegionAddressEntry[] | null | undefined,
  country?: string | null,
  state?: string | null
): boolean {
  const region = regionFromAddresses(addresses);
  if (!region) return false;
  return region.country === country && region.state === state;
}

/** Region match using profile address or GPS reverse-geocode fallback. */
export async function agentMatchesRegion(params: {
  agentAddresses: RegionAddressEntry[] | null | undefined;
  agentLocation?: { latitude: number; longitude: number } | null;
  targetCountry?: string | null;
  targetState?: string | null;
  reverseGeocode?: ReverseGeocodeFn;
}): Promise<boolean> {
  const region = await resolveAgentOperatingRegion({
    agentAddresses: params.agentAddresses,
    agentLocation: params.agentLocation,
    reverseGeocode: params.reverseGeocode,
  });
  if (!region) return false;
  return (
    region.country === params.targetCountry && region.state === params.targetState
  );
}
