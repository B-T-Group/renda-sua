/** Google Maps route from the visitor's current location to the pickup address. */
export function pickupDirectionsUrl(address: string): string {
  const destination = encodeURIComponent(address.trim());
  return `https://www.google.com/maps/dir/?api=1&origin=Current%20Location&destination=${destination}&travelmode=driving`;
}
