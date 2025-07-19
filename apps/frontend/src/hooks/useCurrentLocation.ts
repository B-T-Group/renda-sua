import { useCallback, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}

export interface UseCurrentLocationReturn {
  location: Location | null;
  loading: boolean;
  error: string | null;
  getCurrentLocation: () => Promise<Location>;
  clearLocation: () => void;
}

export const useCurrentLocation = (): UseCurrentLocationReturn => {
  const [location, setLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiClient = useApiClient();

  const reverseGeocode = useCallback(
    async (latitude: number, longitude: number): Promise<Partial<Location>> => {
      if (!apiClient) {
        console.warn('API client not available, skipping reverse geocoding');
        return {};
      }

      try {
        console.log(
          'Making geocode request to:',
          `/google/geocode?lat=${latitude}&lng=${longitude}`
        );
        const response = await apiClient.get('/google/geocode', {
          params: {
            lat: latitude,
            lng: longitude,
          },
        });
        console.log('Geocode response:', response.data);

        if (response.data.success) {
          const result = response.data.result;
          return {
            address: result.formatted_address,
            city: result.city,
            state: result.state,
            country: result.country,
            postalCode: result.postal_code,
          };
        } else {
          throw new Error('Failed to reverse geocode location');
        }
      } catch (err: any) {
        console.error('Error reverse geocoding:', err);
        // Don't throw error, just return empty object to allow coordinates-only location
        return {};
      }
    },
    [apiClient]
  );

  const getCurrentLocation = useCallback(async (): Promise<Location> => {
    console.log('getCurrentLocation called');
    setLoading(true);
    setError(null);

    try {
      // Check if geolocation is supported
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by this browser');
      }

      // Get current position
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000, // 5 minutes
          });
        }
      );

      const { latitude, longitude } = position.coords;
      console.log('Got coordinates:', { latitude, longitude });

      // Create basic location object
      const basicLocation: Location = {
        latitude,
        longitude,
      };

      // Try to get address information
      try {
        const addressInfo = await reverseGeocode(latitude, longitude);
        const fullLocation: Location = {
          ...basicLocation,
          ...addressInfo,
        };

        setLocation(fullLocation);
        return fullLocation;
      } catch (addressError) {
        // If reverse geocoding fails, still return the coordinates
        console.warn('Could not get address for location:', addressError);
        setLocation(basicLocation);
        return basicLocation;
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to get current location';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [reverseGeocode]);

  const clearLocation = useCallback(() => {
    setLocation(null);
    setError(null);
  }, []);

  return {
    location,
    loading,
    error,
    getCurrentLocation,
    clearLocation,
  };
};
