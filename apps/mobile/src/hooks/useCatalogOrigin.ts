import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import type { InventorySortMode } from '@/types/inventoryCatalog';

export interface CatalogOrigin {
  lat: number;
  lng: number;
}

/**
 * Resolves device coordinates for “Nearest” sort, or whenever `always` is set
 * (the Food tab, so distance can show without changing sort).
 */
export function useCatalogOrigin(
  sort: InventorySortMode,
  enabled = true,
  always = false
) {
  const [origin, setOrigin] = useState<CatalogOrigin | null>(null);
  const needsOrigin = always || sort === 'fastest';

  const resolveOrigin = useCallback(async () => {
    if (!needsOrigin || !enabled) {
      setOrigin(null);
      return;
    }
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setOrigin(null);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setOrigin({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      });
    } catch {
      setOrigin(null);
    }
  }, [enabled, needsOrigin]);

  useEffect(() => {
    void resolveOrigin();
  }, [resolveOrigin]);

  return { origin, needsOrigin, refreshOrigin: resolveOrigin };
}
