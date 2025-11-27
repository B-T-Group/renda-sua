/**
 * Service Worker for Background Location Sync
 *
 * Handles background sync events to update agent locations even when the app is closed.
 * This is a standalone JavaScript file (not TypeScript) because service workers
 * must be served as static files from the public directory.
 */

const SYNC_TAG = 'agent-location-update';
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
 * Execute location update via GraphQL upsert mutation
 */
async function executeLocationUpdate(location, authToken, hasuraUrl) {
  try {
    const mutation = `
      mutation insert_agent_locations_one($object: agent_locations_insert_input = {}) {
        insert_agent_locations_one(object: $object, on_conflict: {constraint: agent_locations_agent_id_key, update_columns: [latitude, longitude]}) {
          agent_id
          id
          latitude
          longitude
          updated_at
          created_at
        }
      }

    `;

    const variables = {
      object: {
        agent_id: location.agentId,
        latitude: location.latitude.toString(),
        longitude: location.longitude.toString(),
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
    const { location, authToken, hasuraUrl } = event.data;

    console.log('Received location sync data:', {
      location,
      authToken,
      hasuraUrl,
    });

    // Process single location update
    executeLocationUpdate(location, authToken, hasuraUrl)
      .then((success) => {
        if (success) {
          console.log('Location sync successful');
        } else {
          console.warn('Location sync failed');
        }
      })
      .catch((error) => {
        console.error('Error during location sync:', error);
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
