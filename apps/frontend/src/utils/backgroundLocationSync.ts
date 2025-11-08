/**
 * Background Location Sync Utility
 *
 * Handles background location updates using Service Worker and Background Sync API.
 * This allows location updates to continue even when the app is closed or in the background.
 */

const SYNC_TAG = 'agent-location-update';
const STORAGE_KEY = 'agent_location_queue';

export interface QueuedLocationUpdate {
  id: string;
  agentId: string;
  latitude: number;
  longitude: number;
  timestamp: number;
  retryCount: number;
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
 * Queue a location update for background sync
 */
export const queueLocationUpdate = async (
  agentId: string,
  latitude: number,
  longitude: number
): Promise<void> => {
  const update: QueuedLocationUpdate = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    agentId,
    latitude,
    longitude,
    timestamp: Date.now(),
    retryCount: 0,
  };

  // Store in localStorage for persistence
  const queue = getQueuedUpdates();
  queue.push(update);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));

  // Register background sync
  await registerBackgroundSync();
};

/**
 * Get all queued location updates
 */
export const getQueuedUpdates = (): QueuedLocationUpdate[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error reading queued updates:', error);
    return [];
  }
};

/**
 * Remove a queued update by ID
 */
export const removeQueuedUpdate = (id: string): void => {
  const queue = getQueuedUpdates();
  const filtered = queue.filter((update) => update.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
};

/**
 * Clear all queued updates
 */
export const clearQueuedUpdates = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};
