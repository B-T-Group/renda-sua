import { describe, expect, it } from 'vitest';
import { pickupDirectionsUrls } from './pickupDirectionsUrl';

const ADDRESS = "1 Rue de l'Église, Montréal, QC";
const DEST = encodeURIComponent(ADDRESS);

describe('pickupDirectionsUrls', () => {
  it('opens Apple Maps from the current location on iOS', () => {
    expect(pickupDirectionsUrls(ADDRESS, 'ios').primary).toBe(
      `https://maps.apple.com/?saddr=Current%20Location&daddr=${DEST}&dirflg=d`
    );
  });

  it('starts Google Maps navigation on Android and falls back to the web route', () => {
    const urls = pickupDirectionsUrls(ADDRESS, 'android');
    expect(urls.primary).toBe(`google.navigation:q=${DEST}`);
    expect(urls.fallback).toContain('google.com/maps/dir/?api=1&origin=Current%20Location');
    expect(urls.fallback).toContain(`destination=${DEST}`);
  });

  it('uses the Google Maps route everywhere else', () => {
    const urls = pickupDirectionsUrls(`  ${ADDRESS} `, 'web');
    expect(urls.primary).toBe(urls.fallback);
    expect(urls.primary).toContain(`destination=${DEST}`);
  });
});
