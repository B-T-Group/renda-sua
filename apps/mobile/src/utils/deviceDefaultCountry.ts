import * as Localization from 'expo-localization';
import { getCountries, type CountryCode } from 'libphonenumber-js';

export const DEVICE_COUNTRY_RESOLVE_TIMEOUT_MS = 5000;
export const DEVICE_COUNTRY_FALLBACK: CountryCode = 'CM';

const POLL_INTERVAL_MS = 200;

/** Reads device locale region when it maps to a libphonenumber-supported country. */
export function tryResolveDeviceCountryCode(): CountryCode | null {
  const countries = getCountries();
  const region = Localization.getLocales?.()?.[0]?.regionCode?.toUpperCase();
  if (region && countries.includes(region as CountryCode)) {
    return region as CountryCode;
  }
  return null;
}

/**
 * Resolves device country, polling until success or timeout (default 5s), then CM.
 */
export function resolveDeviceDefaultCountryCode(
  maxWaitMs: number = DEVICE_COUNTRY_RESOLVE_TIMEOUT_MS
): Promise<CountryCode> {
  const immediate = tryResolveDeviceCountryCode();
  if (immediate) {
    return Promise.resolve(immediate);
  }

  return new Promise((resolve) => {
    const deadline = Date.now() + maxWaitMs;

    const tick = () => {
      const code = tryResolveDeviceCountryCode();
      if (code) {
        resolve(code);
        return;
      }
      if (Date.now() >= deadline) {
        resolve(DEVICE_COUNTRY_FALLBACK);
        return;
      }
      setTimeout(tick, POLL_INTERVAL_MS);
    };

    tick();
  });
}

/** Synchronous device country; uses locale when available, otherwise CM. */
export function getDeviceDefaultCountryCode(): CountryCode {
  return tryResolveDeviceCountryCode() ?? DEVICE_COUNTRY_FALLBACK;
}

/** Prefer an explicit ISO2 (profile/address), else the device locale, else CM. */
export function pickDefaultPhoneCountry(preferred?: string | null): CountryCode {
  const p = preferred?.trim().toUpperCase();
  const countries = getCountries();
  if (p && countries.includes(p as CountryCode)) return p as CountryCode;
  return getDeviceDefaultCountryCode();
}
