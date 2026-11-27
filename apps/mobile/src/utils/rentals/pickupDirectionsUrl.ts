export type DirectionsPlatform = 'ios' | 'android' | 'web' | string;

export interface PickupDirectionsUrls {
  primary: string;
  fallback: string;
}

/** Directions from the user's current location to the pickup address, per platform maps app. */
export function pickupDirectionsUrls(address: string, os: DirectionsPlatform): PickupDirectionsUrls {
  const destination = encodeURIComponent(address.trim());
  const fallback = `https://www.google.com/maps/dir/?api=1&origin=Current%20Location&destination=${destination}&travelmode=driving`;
  if (os === 'ios') {
    return { primary: `https://maps.apple.com/?saddr=Current%20Location&daddr=${destination}&dirflg=d`, fallback };
  }
  if (os === 'android') return { primary: `google.navigation:q=${destination}`, fallback };
  return { primary: fallback, fallback };
}
