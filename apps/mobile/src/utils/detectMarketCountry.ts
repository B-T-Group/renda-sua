import * as Location from 'expo-location';
import { DEFAULT_MARKET_CODE } from '../types/market';
import { getDeviceDefaultCountryCode } from './deviceDefaultCountry';
import { requestForegroundPermission } from './agentLocationPermissionFlow';
import { normalizeStateCode } from './stateNormalizer';

const GPS_TIMEOUT_MS = 8000;

export interface DetectedMarketLocation {
  countryCode: string;
  /** State/region name as returned by the device reverse-geocoder.
   *  Matches the value stored in addresses.state on the backend.
   *  null when no region could be determined. */
  stateCode: string | null;
}

function timeout(ms: number): Promise<null> {
  return new Promise((resolve) => setTimeout(() => resolve(null), ms));
}

async function positionWithTimeout(): Promise<Location.LocationObject | null> {
  // getCurrentPositionAsync has no built-in timeout that works on both
  // platforms, so we race it against a plain setTimeout guard.
  const result = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
    timeout(GPS_TIMEOUT_MS),
  ]);
  return result;
}

async function locationFromGps(): Promise<DetectedMarketLocation | null> {
  try {
    const granted = await requestForegroundPermission();
    if (!granted) return null;

    const pos = await positionWithTimeout();
    if (!pos) return null;

    const [place] = await Location.reverseGeocodeAsync({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    });

    const countryCode = place?.isoCountryCode?.toUpperCase() ?? null;
    if (!countryCode || countryCode.length !== 2) return null;

    // `region` may be an ISO abbreviation (e.g. "QC") or a full name (e.g. "Quebec")
    // depending on platform/locale. Normalize to the full name used by the backend.
    const rawRegion = place?.region?.trim() ?? null;
    const stateCode = rawRegion
      ? normalizeStateCode(countryCode, rawRegion)
      : null;

    return { countryCode, stateCode };
  } catch {
    return null;
  }
}

/**
 * Detects the device country and state for market initialisation.
 * Resolution order: GPS reverse-geocode → device locale (country only) → CM default.
 * Never throws — always returns a DetectedMarketLocation.
 */
export async function detectMarketLocation(): Promise<DetectedMarketLocation> {
  const gps = await locationFromGps();
  if (gps) return gps;

  const localeCountry = getDeviceDefaultCountryCode();
  if (localeCountry && localeCountry.length === 2) {
    return { countryCode: localeCountry, stateCode: null };
  }

  return { countryCode: DEFAULT_MARKET_CODE, stateCode: null };
}

/** Backward-compatible: returns only the country code string. */
export async function detectMarketCountry(): Promise<string> {
  const loc = await detectMarketLocation();
  return loc.countryCode;
}
