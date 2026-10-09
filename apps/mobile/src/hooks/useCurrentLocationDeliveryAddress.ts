import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { agentApi } from '../services/agentApi';
import { requestForegroundPermission } from '../utils/agentLocationPermissionFlow';

const LOCATION_TIMEOUT_MS = 10_000;

export type CurrentLocationDeliveryStatus =
  | 'idle'
  | 'resolving'
  | 'denied'
  | 'failed'
  | 'success';

interface Options {
  /** Resolve GPS once when the shopper has no saved address. */
  auto?: boolean;
  onResolved?: (addressId: string) => void | Promise<void>;
}

export function useCurrentLocationDeliveryAddress(options: Options = {}) {
  const [status, setStatus] = useState<CurrentLocationDeliveryStatus>('idle');
  const started = useRef(false);
  const onResolved = options.onResolved;

  const resolve = useCallback(async (): Promise<string | null> => {
    setStatus('resolving');
    const granted = await requestForegroundPermission();
    if (!granted) {
      setStatus('denied');
      return null;
    }
    try {
      const position = await readPosition();
      const response = await agentApi.addresses.currentLocation({
        latitude: position.latitude,
        longitude: position.longitude,
      });
      const id = response.data?.address?.id ?? null;
      if (!id) {
        setStatus('failed');
        return null;
      }
      setStatus('success');
      await onResolved?.(id);
      return id;
    } catch {
      setStatus('failed');
      return null;
    }
  }, [onResolved]);

  useEffect(() => {
    if (!options.auto || started.current || status !== 'idle') return;
    started.current = true;
    void resolve();
  }, [options.auto, resolve, status]);

  return { status, resolve };
}

async function readPosition(): Promise<{ latitude: number; longitude: number }> {
  const position = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), LOCATION_TIMEOUT_MS)
    ),
  ]);
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
}
