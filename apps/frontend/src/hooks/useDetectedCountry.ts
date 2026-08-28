import { useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

export const DETECTED_COUNTRY_STORAGE_KEY = 'rendasua_detected_country_code';
export const DETECTED_COUNTRY_EVENT = 'rendasua-detected-country';

const IPAPI_URL = 'https://ipapi.co/json/';

function persistDetectedCountry(code: string): void {
  const upper = code.toUpperCase();
  localStorage.setItem(DETECTED_COUNTRY_STORAGE_KEY, upper);
  window.dispatchEvent(
    new CustomEvent(DETECTED_COUNTRY_EVENT, { detail: upper })
  );
}

/**
 * Detects the anonymous user's country via IP geolocation and stores it in localStorage.
 * Only runs when the user is not authenticated and no value is already stored.
 * Used to bootstrap market selection for guests.
 */
export function useDetectedCountry(): void {
  const { isAuthenticated } = useAuth0();

  useEffect(() => {
    if (isAuthenticated) return;
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (localStorage.getItem(DETECTED_COUNTRY_STORAGE_KEY)) return;

    let cancelled = false;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const detect = async () => {
      try {
        const res = await fetch(IPAPI_URL, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const code = data?.country_code;
        if (code && typeof code === 'string' && !cancelled) {
          persistDetectedCountry(code);
        }
      } catch {
        // Non-blocking: do nothing on failure
      } finally {
        clearTimeout(timeoutId);
      }
    };

    detect();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [isAuthenticated]);
}
