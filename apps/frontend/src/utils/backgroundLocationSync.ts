/**
 * Background Location Sync Utility
 * 
 * Handles background location updates using Service Worker and Background Sync API.
 * This allows location updates to continue even when the app is closed or in the background.
 */

import { environment } from '../config/environment';

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
    'sync' in ServiceWorkerRegistration.prototype
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
    await registration.sync.register(tag);
    console.log('Background sync registered:', tag);
    return true;
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

/**
 * Execute location update via GraphQL mutation
 * This is called from the service worker
 */
export const executeLocationUpdate = async (
  update: QueuedLocationUpdate,
  authToken: string
): Promise<boolean> => {
  try {
    const mutation = `
      mutation InsertAgentLocation($locationData: agent_locations_insert_input!) {
        insert_agent_locations_one(object: $locationData) {
          id
          agent_id
          latitude
          longitude
          created_at
        }
      }
    `;

    const variables = {
      locationData: {
        agent_id: update.agentId,
        latitude: update.latitude.toString(),
        longitude: update.longitude.toString(),
      },
    };

    const response = await fetch(environment.hasuraUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        query: mutation,
        variables,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result.errors) {
      throw new Error(result.errors[0]?.message || 'GraphQL error');
    }

    console.log('Location update successful:', result.data);
    return true;
  } catch (error) {
    console.error('Error executing location update:', error);
    return false;
  }
};

/**
 * Process all queued location updates
 * This is called from the service worker sync event
 */
export const processQueuedUpdates = async (
  authToken: string
): Promise<{ succeeded: number; failed: number }> => {
  const queue = getQueuedUpdates();
  let succeeded = 0;
  let failed = 0;

  console.log(`Processing ${queue.length} queued location updates`);

  for (const update of queue) {
    const success = await executeLocationUpdate(update, authToken);

    if (success) {
      removeQueuedUpdate(update.id);
      succeeded++;
    } else {
      // Increment retry count
      update.retryCount++;
      const updatedQueue = getQueuedUpdates().map((u) =>
        u.id === update.id ? update : u
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedQueue));

      // Remove after 3 retries
      if (update.retryCount >= 3) {
        removeQueuedUpdate(update.id);
        failed++;
      }
    }
  }

  return { succeeded, failed };
};

