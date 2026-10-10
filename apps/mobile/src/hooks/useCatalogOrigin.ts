import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';

export interface CatalogOrigin {
  lat: number;
  lng: number;
}

/** Reads the device fix used as the catalog distance origin. */
export async function readDeviceCatalogOrigin(): Promise<CatalogOrigin | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}

/**
 * Device coordinates for catalog distance. Requested for every shopper
 * while the catalog is enabled, including signed-in users.
 */
export function useCatalogOrigin(enabled = true) {
  const [origin, setOrigin] = useState<CatalogOrigin | null>(null);

  const resolveOrigin = useCallback(async () => {
    if (!enabled) {
      setOrigin(null);
      return;
    }
    setOrigin(await readDeviceCatalogOrigin());
  }, [enabled]);

  useEffect(() => {
    void resolveOrigin();
  }, [resolveOrigin]);

  return { origin, needsOrigin: enabled, refreshOrigin: resolveOrigin };
}
