/**
 * Service Worker for Background Location Sync
 *
 * Handles background sync events to update agent locations even when the app is closed.
 * This is a standalone JavaScript file (not TypeScript) because service workers
 * must be served as static files from the public directory.
 */

const SYNC_TAG = 'agent-location-update';
const STORAGE_KEY = 'agent_location_queue';
const CACHE_NAME = 'rendasua-location-cache-v1';

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  // Force activation of new service worker
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    (async () => {
      // Take control of all pages immediately
      await self.clients.claim();

      // Clean up old caches
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })()
  );
});

// Background Sync event - handle location updates
self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    console.log('Background sync triggered for location update');
    event.waitUntil(handleLocationSync());
  }
});

/**
 * Get queued location updates from localStorage
 */
function getQueuedUpdates() {
  try {
    // Note: Service workers can't access localStorage directly
    // We'll use IndexedDB or get data from the client
    return [];
  } catch (error) {
    console.error('Error reading queued updates:', error);
    return [];
  }
}

/**
 * Execute location update via GraphQL mutation
 */
async function executeLocationUpdate(update, authToken, hasuraUrl) {
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

    const response = await fetch(hasuraUrl, {
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
}

/**
 * Handle location sync event
 */
async function handleLocationSync() {
  try {
    // Get auth token and hasura URL from client
    const clients = await self.clients.matchAll({
      includeUncontrolled: true,
    });

    if (clients.length === 0) {
      console.warn('No clients available for location sync');
      return;
    }

    // Request location update data from client
    const client = clients[0];
    client.postMessage({ type: 'REQUEST_LOCATION_SYNC' });

    // The client will respond with the location data and auth token
    // This is handled via message event listener below
  } catch (error) {
    console.error('Error in location sync:', error);
  }
}

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data.type === 'LOCATION_SYNC_DATA') {
    const { updates, authToken, hasuraUrl } = event.data;

    console.log('Received location sync data:', {
      updates,
      authToken,
      hasuraUrl,
    });

    // Process all updates
    Promise.all(
      updates.map((update, index) =>
        executeLocationUpdate(update, authToken, hasuraUrl).then((success) => ({
          success,
          updateId: update.id,
          index,
        }))
      )
    ).then((results) => {
      const succeeded = results.filter((r) => r.success === true);
      const failed = results.filter((r) => r.success === false);
      const succeededIds = succeeded.map((r) => r.updateId);

      console.log(
        `Location sync complete: ${succeeded.length} succeeded, ${failed.length} failed`
      );

      // Notify client to clear successful updates from localStorage
      if (succeededIds.length > 0) {
        const clients = self.clients.matchAll({
          includeUncontrolled: true,
        });
        clients.then((clientList) => {
          clientList.forEach((client) => {
            client.postMessage({
              type: 'CLEAR_LOCATION_UPDATES',
              succeededIds,
            });
          });
        });
      }
    });
  } else if (event.data.type === 'AUTH_TOKEN_UPDATE') {
    // Store token in IndexedDB for service worker use
    storeAuthToken(event.data.token);
  }
});

/**
 * Store auth token in IndexedDB
 */
async function storeAuthToken(token) {
  try {
    const db = await openAuthDB();
    if (db) {
      const transaction = db.transaction(['tokens'], 'readwrite');
      const store = transaction.objectStore('tokens');
      await store.put({ id: 'auth_token', value: token });
    }
  } catch (error) {
    console.warn('Failed to store auth token:', error);
  }
}

/**
 * Open IndexedDB for auth token storage
 */
function openAuthDB() {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open('rendasua-auth', 1);

      request.onerror = () => {
        console.warn('Failed to open auth DB');
        resolve(null);
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('tokens')) {
          db.createObjectStore('tokens', { keyPath: 'id' });
        }
      };
    } catch (error) {
      console.warn('IndexedDB not available:', error);
      resolve(null);
    }
  });
}
