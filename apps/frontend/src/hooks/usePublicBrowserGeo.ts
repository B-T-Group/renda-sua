import { useEffect, useState } from 'react';

export const PUBLIC_BROWSER_GEO_STORAGE_KEY = 'rendasua_public_browser_geo_v1';

export interface PublicBrowserGeo {
  lat: number;
  lng: number;
}

function readStored(): PublicBrowserGeo | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PUBLIC_BROWSER_GEO_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { lat?: number; lng?: number };
    if (
      typeof parsed.lat === 'number' &&
      typeof parsed.lng === 'number' &&
      Number.isFinite(parsed.lat) &&
      Number.isFinite(parsed.lng)
    ) {
      return { lat: parsed.lat, lng: parsed.lng };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * For anonymous users: reuse coordinates from localStorage or request once via Geolocation API.
 */
export function usePublicBrowserGeo(enabled: boolean): PublicBrowserGeo | null {
  const [coords, setCoords] = useState<PublicBrowserGeo | null>(() =>
    enabled ? readStored() : null
  );

  useEffect(() => {
    if (!enabled) {
      setCoords(null);
      return;
    }
    const stored = readStored();
    if (stored) {
      setCoords(stored);
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        try {
          localStorage.setItem(
            PUBLIC_BROWSER_GEO_STORAGE_KEY,
            JSON.stringify(next)
          );
        } catch {
          /* ignore quota */
        }
        setCoords(next);
      },
      () => {
        /* denied or timeout — leave null */
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 600_000 }
    );
  }, [enabled]);

  return enabled ? coords : null;
}
