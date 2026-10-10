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

function persist(coords: PublicBrowserGeo): void {
  try {
    localStorage.setItem(PUBLIC_BROWSER_GEO_STORAGE_KEY, JSON.stringify(coords));
  } catch {
    /* ignore quota */
  }
}

type BrowserGeoReader = {
  getCurrentPosition: (
    success: (pos: { coords: { latitude: number; longitude: number } }) => void,
    error: () => void,
    options: PositionOptions
  ) => void;
};

/** Requests a fresh catalog fix and keeps the last saved one if the browser refuses. */
export function subscribeBrowserCatalogGeo(
  geolocation: BrowserGeoReader | null | undefined,
  onCoords: (coords: PublicBrowserGeo) => void
): () => void {
  const stored = readStored();
  if (stored) onCoords(stored);
  if (!geolocation) return () => undefined;
  let cancelled = false;
  geolocation.getCurrentPosition(
    (pos) => {
      if (cancelled) return;
      const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      persist(next);
      onCoords(next);
    },
    () => {
      /* denied or timeout — keep a previously saved fix */
    },
    { enableHighAccuracy: false, timeout: 12_000, maximumAge: 600_000 }
  );
  return () => {
    cancelled = true;
  };
}

/**
 * Current browser coordinates for catalog distance.
 * A saved fix paints immediately; a fresh reading replaces it when permission allows.
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
    return subscribeBrowserCatalogGeo(navigator?.geolocation, setCoords);
  }, [enabled]);

  return enabled ? coords : null;
}
