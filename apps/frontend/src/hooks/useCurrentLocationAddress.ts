import { useCallback, useState } from 'react';
import { useApiClient } from './useApiClient';
import { useCurrentLocation } from './useCurrentLocation';

export type CurrentLocationAddressStatus =
  | 'idle'
  | 'resolving'
  | 'denied'
  | 'failed'
  | 'success';

function isLocationDenied(err: unknown): boolean {
  const code = (err as { code?: number })?.code;
  if (code === 1) return true;
  const message = err instanceof Error ? err.message : String(err ?? '');
  return /denied|not supported|permission/i.test(message);
}

export function useCurrentLocationAddress() {
  const apiClient = useApiClient();
  const { getCurrentLocation } = useCurrentLocation();
  const [status, setStatus] = useState<CurrentLocationAddressStatus>('idle');
  const [addressId, setAddressId] = useState<string | null>(null);

  const resolve = useCallback(async (): Promise<string | null> => {
    if (!apiClient) {
      setStatus('failed');
      return null;
    }
    setStatus('resolving');
    try {
      const location = await getCurrentLocation(true);
      const response = await apiClient.post('/addresses/current-location', {
        latitude: location.latitude,
        longitude: location.longitude,
      });
      const id = response.data?.data?.address?.id as string | undefined;
      if (!id) {
        setStatus('failed');
        return null;
      }
      setAddressId(id);
      setStatus('success');
      return id;
    } catch (err: unknown) {
      setStatus(isLocationDenied(err) ? 'denied' : 'failed');
      return null;
    }
  }, [apiClient, getCurrentLocation]);

  return { status, addressId, resolve };
}
