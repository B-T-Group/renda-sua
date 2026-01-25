/**
 * Agent Location Tracker Hook
 *
 * Tracks agent location coordinates and updates them periodically (every 15-30 minutes).
 * Works in the background using Service Worker and Background Sync API.
 */

import { useAuth0 } from '@auth0/auth0-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { environment } from '../config/environment';
import { useUserProfileContext } from '../contexts/UserProfileContext';
import {
  clearLastLocation,
  getLastLocation,
  isBackgroundSyncSupported,
  registerBackgroundSync,
  storeLastLocation,
} from '../utils/backgroundLocationSync';
import { useGraphQLRequest } from './useGraphQLRequest';

// Default update interval: 20 minutes (1200000 ms)
const DEFAULT_UPDATE_INTERVAL = 20 * 60 * 1000;

// Minimum distance change to trigger update (in meters)
const MIN_DISTANCE_CHANGE = 100; // 100 meters

const UPSERT_AGENT_LOCATION = `
  mutation UpsertAgentLocation($locationData: agent_locations_insert_input!, $onConflict: agent_locations_on_conflict!) {
    insert_agent_locations_one(object: $locationData, on_conflict: $onConflict) {
      id
      agent_id
      latitude
      longitude
      created_at
      updated_at
    }
  }
`;

interface UseAgentLocationTrackerOptions {
  /** Update interval in milliseconds (default: 20 minutes) */
  updateInterval?: number;
  /** Enable background sync (default: true) */
  enableBackgroundSync?: boolean;
}

interface UseAgentLocationTrackerReturn {
  /** Whether tracking is active */
  isTracking: boolean;
  /** Last update timestamp */
  lastUpdate: number | null;
  /** Error message if any */
  error: string | null;
  /** Manually trigger location update */
  updateLocation: () => Promise<void>;
  /** Start tracking */
  startTracking: () => void;
  /** Stop tracking */
  stopTracking: () => void;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

export const useAgentLocationTracker = (
  options: UseAgentLocationTrackerOptions = {}
): UseAgentLocationTrackerReturn => {
  const {
    updateInterval = DEFAULT_UPDATE_INTERVAL,
    enableBackgroundSync = true,
  } = options;

  const { isAuthenticated } = useAuth0();
  const { profile, userType } = useUserProfileContext();
  const { execute: upsertLocation } = useGraphQLRequest(UPSERT_AGENT_LOCATION);

  const [isTracking, setIsTracking] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const serviceWorkerRef = useRef<ServiceWorkerRegistration | null>(null);
  const isUpdatingRef = useRef<boolean>(false);
  const hasInitialUpdateRef = useRef<boolean>(false);

  // Check if user is an agent
  const isAgent = userType === 'agent' && !!profile?.agent;

  /**
   * Get current location coordinates (no geocoding)
   */
  const getCurrentCoordinates = useCallback((): Promise<{
    latitude: number;
    longitude: number;
  }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          reject(new Error(`Geolocation error: ${error.message}`));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000, // 5 minutes
        }
      );
    });
  }, []);

  /**
   * Update location in database
   */
  const updateLocation = useCallback(async () => {
    if (!isAgent || !profile?.agent) {
      return;
    }

    // Prevent concurrent updates
    if (isUpdatingRef.current) {
      console.log('Location update already in progress, skipping');
      return;
    }

    try {
      isUpdatingRef.current = true;
      setError(null);

      // Get current location coordinates (no geocoding)
      const coordinates = await getCurrentCoordinates();

      if (!coordinates.latitude || !coordinates.longitude) {
        throw new Error('Invalid location coordinates');
      }

      // Check if location has changed significantly
      if (lastLocationRef.current) {
        const distance = calculateDistance(
          lastLocationRef.current.lat,
          lastLocationRef.current.lng,
          coordinates.latitude,
          coordinates.longitude
        );

        if (distance < MIN_DISTANCE_CHANGE) {
          console.log(
            `Location change too small (${distance.toFixed(
              0
            )}m), skipping update`
          );
          return;
        }
      }

      // Update last location
      lastLocationRef.current = {
        lat: coordinates.latitude,
        lng: coordinates.longitude,
      };

      // If background sync is enabled and supported, store the location
      if (enableBackgroundSync && isBackgroundSyncSupported()) {
        await storeLastLocation(
          profile.agent.id,
          coordinates.latitude,
          coordinates.longitude
        );

        // Also try to register background sync
        await registerBackgroundSync();
      } else {
        // Direct update via GraphQL upsert
        await upsertLocation({
          locationData: {
            agent_id: profile.agent.id,
            latitude: coordinates.latitude.toString(),
            longitude: coordinates.longitude.toString(),
          },
          onConflict: {
            constraint: 'idx_agent_locations_agent_id_unique',
            update_columns: ['latitude', 'longitude'],
          },
        });

        // Clear stored location since we just successfully updated directly
        clearLastLocation();
      }

      setLastUpdate(Date.now());
      hasInitialUpdateRef.current = true;
      console.log('Location updated successfully:', {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      });
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update agent location';
      setError(errorMessage);
      console.error('Error updating location:', err);
      // Don't throw - this is a background operation
    } finally {
      isUpdatingRef.current = false;
    }
  }, [
    isAgent,
    profile,
    getCurrentCoordinates,
    upsertLocation,
    enableBackgroundSync,
  ]);

  /**
   * Start tracking
   */
  const startTracking = useCallback(() => {
    if (!isAgent || !isAuthenticated) {
      return;
    }

    // Check if already tracking using ref to avoid dependency issues
    if (intervalRef.current !== null) {
      console.log('Location tracking already active');
      return;
    }

    console.log('Starting agent location tracking');

    // Register service worker if background sync is enabled
    if (enableBackgroundSync && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then((registration) => {
          serviceWorkerRef.current = registration;
          console.log('Service worker registered');
        })
        .catch((err) => {
          console.error('Service worker registration failed:', err);
        });
    }

    // Initial update (only if we haven't done one yet)
    if (!hasInitialUpdateRef.current) {
      updateLocation();
    }

    // Set up periodic updates
    intervalRef.current = setInterval(() => {
      updateLocation();
    }, updateInterval);

    setIsTracking(true);
  }, [
    isAgent,
    isAuthenticated,
    updateLocation,
    updateInterval,
    enableBackgroundSync,
  ]);

  /**
   * Stop tracking
   */
  const stopTracking = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setIsTracking(false);
    hasInitialUpdateRef.current = false;
    console.log('Stopped agent location tracking');
  }, []);

  // Auto-start tracking when agent is authenticated
  useEffect(() => {
    // Only start if we're an agent, authenticated, and not already tracking
    if (isAgent && isAuthenticated && intervalRef.current === null) {
      startTracking();
    } else if ((!isAgent || !isAuthenticated) && intervalRef.current !== null) {
      stopTracking();
    }

    // Cleanup on unmount
    return () => {
      if (intervalRef.current !== null) {
        stopTracking();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAgent, isAuthenticated]); // Only depend on these to avoid recreating on every updateLocation change

  // Update auth token in service worker and handle sync requests
  const { getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    if (isAuthenticated && 'serviceWorker' in navigator) {
      const handleMessage = async (event: MessageEvent) => {
        if (event.data.type === 'REQUEST_LOCATION_SYNC') {
          // Service worker is requesting location sync data
          // Send last stored location and auth token
          try {
            const location = getLastLocation();
            if (!location) {
              console.log('No location data to sync');
              return;
            }

            const token = await getAccessTokenSilently();

            // Send data to service worker
            const registration = await navigator.serviceWorker.ready;
            if (registration.active) {
              registration.active.postMessage({
                type: 'LOCATION_SYNC_DATA',
                location,
                authToken: token,
                hasuraUrl: environment.hasuraUrl,
              });
            }
          } catch (error) {
            console.error('Error handling location sync request:', error);
          }
        }
      };

      navigator.serviceWorker.addEventListener('message', handleMessage);

      return () => {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      };
    }
    return undefined;
  }, [isAuthenticated, getAccessTokenSilently]);

  return {
    isTracking,
    lastUpdate,
    error,
    updateLocation,
    startTracking,
    stopTracking,
  };
};
