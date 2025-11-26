/**
 * Background Location Sync Utility
 *
 * Handles background location updates using Service Worker and Background Sync API.
 * This allows location updates to continue even when the app is closed or in the background.
 * Stores only the last known location per agent (single record, not a queue).
 */

const SYNC_TAG = 'agent-location-update';
const STORAGE_KEY = 'agent_last_location';

export interface LastAgentLocation {
  agentId: string;
  latitude: number;
  longitude: number;
}

/**
 * Check if Background Sync API is supported
 */
export const isBackgroundSyncSupported = (): boolean => {
  return (
    'serviceWorker' in navigator &&
    'sync' in (ServiceWorkerRegistration.prototype as any)
  );
};

/**
 * Register background sync for periodic location updates
 */
export const registerBackgroundSync = async (
  tag: string = SYNC_TAG
): Promise<boolean> => {
  if (!isBackgroundSyncSupported()) {
    console.warn('Background Sync API not supported');
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const syncManager = (registration as any).sync;
    if (syncManager) {
      await syncManager.register(tag);
      console.log('Background sync registered:', tag);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to register background sync:', error);
    return false;
  }
};

/**
 * Store the last known location for background sync
 */
export const storeLastLocation = async (
  agentId: string,
  latitude: number,
  longitude: number
): Promise<void> => {
  const location: LastAgentLocation = {
    agentId,
    latitude,
    longitude,
  };

  // Store in localStorage for persistence (overwrites previous location)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(location));

  // Register background sync
  await registerBackgroundSync();
};

/**
 * Get the last stored location
 */
export const getLastLocation = (): LastAgentLocation | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Error reading last location:', error);
    return null;
  }
};

/**
 * Clear the stored last location
 */
export const clearLastLocation = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};
