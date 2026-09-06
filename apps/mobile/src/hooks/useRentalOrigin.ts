import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import type { RentalOrigin } from '../types/rentals';

/**
 * Resolves device coordinates when proximity features need an origin.
 */
export function useRentalOrigin(needsOrigin: boolean, enabled = true) {
  const [origin, setOrigin] = useState<RentalOrigin | null>(null);

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
