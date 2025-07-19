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

export interface CachedLocation extends Location {
  timestamp: number;
}

export interface UseCurrentLocationReturn {
  location: Location | null;
  loading: boolean;
  error: string | null;
  getCurrentLocation: (forceRefresh?: boolean) => Promise<Location>;
  clearLocation: () => void;
  clearCache: () => void;
}

// Cache duration in milliseconds (default: 5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

// In-memory cache for location data
let locationCache: CachedLocation | null = null;

export const useCurrentLocation = (
  cacheDuration: number = CACHE_DURATION
): UseCurrentLocationReturn => {
  const [location, setLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiClient = useApiClient();

  const isCacheValid = useCallback(
    (cachedLocation: CachedLocation): boolean => {
      const now = Date.now();
      return now - cachedLocation.timestamp < cacheDuration;
    },
    [cacheDuration]
  );

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

  const getCurrentLocation = useCallback(
    async (forceRefresh: boolean = false): Promise<Location> => {
      console.log('getCurrentLocation called', { forceRefresh });
      setLoading(true);
      setError(null);

      try {
        // Check cache first (unless force refresh is requested)
        if (!forceRefresh && locationCache && isCacheValid(locationCache)) {
          console.log('Using cached location data');
          setLocation(locationCache);
          setLoading(false);
          return locationCache;
        }

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

          // Cache the result
          const cachedLocation: CachedLocation = {
            ...fullLocation,
            timestamp: Date.now(),
          };
          locationCache = cachedLocation;

          setLocation(fullLocation);
          return fullLocation;
        } catch (addressError) {
          // If reverse geocoding fails, still return the coordinates
          console.warn('Could not get address for location:', addressError);

          // Cache the basic location
          const cachedLocation: CachedLocation = {
            ...basicLocation,
            timestamp: Date.now(),
          };
          locationCache = cachedLocation;

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
    },
    [reverseGeocode, isCacheValid]
  );

  const clearLocation = useCallback(() => {
    setLocation(null);
    setError(null);
  }, []);

  const clearCache = useCallback(() => {
    locationCache = null;
    console.log('Location cache cleared');
  }, []);

  return {
    location,
    loading,
    error,
    getCurrentLocation,
    clearLocation,
    clearCache,
  };
};
