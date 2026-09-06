import { useCallback, useState } from 'react';
import * as Location from 'expo-location';
import { requestForegroundPermission } from '../utils/agentLocationPermissionFlow';
import { reverseGeocode } from '../services/googleMapsApi';
import { alignGeocodeToCscFields } from '../utils/addressRegionMatch';
import type { DeliveryAddressFormValue } from '../components/forms/DeliveryAddressForm';

const LOCATION_TIMEOUT_MS = 10_000;

export type AddressFromLocationStatus = 'idle' | 'detecting' | 'denied' | 'failed' | 'success';

export interface AddressFromLocationResult {
  status: AddressFromLocationStatus;
  detectedValue: DeliveryAddressFormValue | null;
  detect: () => Promise<{ value: DeliveryAddressFormValue | null; status: AddressFromLocationStatus }>;
  reset: () => void;
}

const EMPTY: DeliveryAddressFormValue = {
  address_line_1: '',
  address_line_2: '',
  city: '',
  state: '',
  postal_code: '',
  country: '',
};

export function useAddressFromCurrentLocation(): AddressFromLocationResult {
  const [status, setStatus] = useState<AddressFromLocationStatus>('idle');
  const [detectedValue, setDetectedValue] = useState<DeliveryAddressFormValue | null>(null);

  const detect = useCallback(async (): Promise<{ value: DeliveryAddressFormValue | null; status: AddressFromLocationStatus }> => {
    setStatus('detecting');
    setDetectedValue(null);

    const granted = await requestForegroundPermission();
    if (!granted) {
      setStatus('denied');
      return { value: null, status: 'denied' };
    }

    let coords: { latitude: number; longitude: number } | null = null;
    try {
      const position = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), LOCATION_TIMEOUT_MS)
        ),
      ]);
      coords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
    } catch {
      setStatus('failed');
      return { value: null, status: 'failed' };
    }

    let geocoded = null;
    try {
      geocoded = await reverseGeocode(coords.latitude, coords.longitude);
    } catch {
      setStatus('failed');
      return { value: null, status: 'failed' };
    }

    if (!geocoded) {
      setStatus('failed');
      return { value: null, status: 'failed' };
    }

    const aligned = await alignGeocodeToCscFields(geocoded);
    const value: DeliveryAddressFormValue = {
      ...EMPTY,
      address_line_1: geocoded.address_line_1 || geocoded.formatted_address || '',
      postal_code: geocoded.postal_code || '',
      country: aligned.country,
      state: aligned.state,
      city: aligned.city,
      latitude: coords.latitude,
      longitude: coords.longitude,
    };

    setDetectedValue(value);
    setStatus('success');
    return { value, status: 'success' };
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setDetectedValue(null);
  }, []);

  return { status, detectedValue, detect, reset };
}
