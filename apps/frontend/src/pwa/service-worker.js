/* eslint-disable no-restricted-globals */
/* eslint-disable no-undef */

// Workbox is injected at build time (InjectManifest).
// eslint-disable-next-line no-underscore-dangle
self.__WB_DISABLE_DEV_LOGS = true;

import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, setCatchHandler } from 'workbox-routing';
import { StaleWhileRevalidate, NetworkFirst, NetworkOnly } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

clientsClaim();

// Precache build assets + app shell
precacheAndRoute(self.__WB_MANIFEST);

// SPA navigation fallback: serve cached index.html
registerRoute(
  ({ request }) => request.mode === 'navigate',
  createHandlerBoundToURL('/index.html')
);

// Static assets (same-origin): SWR for quick loads + background refresh
registerRoute(
  ({ request, url }) =>
    url.origin === self.location.origin &&
    (request.destination === 'style' ||
      request.destination === 'script' ||
      request.destination === 'worker' ||
      request.destination === 'image' ||
      request.destination === 'font'),
  new StaleWhileRevalidate({
    cacheName: 'rendasua-static-v1',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  })
);

// i18n locales (same-origin): cache JSON for app-shell offline
registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/locales/'),
  new StaleWhileRevalidate({
    cacheName: 'rendasua-locales-v1',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  })
);

// API requests: prefer network; avoid caching authenticated JSON by default.
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'rendasua-api-v1',
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 }),
    ],
  })
);

// Hasura/Auth0 are cross-origin in this app; don't cache by default.
registerRoute(
  ({ url }) => url.origin !== self.location.origin,
  new NetworkOnly()
);

setCatchHandler(async ({ event }) => {
  if (event.request.destination === 'document') {
    return caches.match('/index.html');
  }
  return Response.error();
});

// --- Custom logic preserved from previous SW (push + background sync) ---

const SYNC_TAG = 'agent-location-update';
const CACHE_NAME = 'rendasua-location-cache-v1';

self.addEventListener('install', () => {
  // Activate new SW as soon as it’s ready.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })()
  );
});

// Allow the app to request immediate activation.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (event.data?.type === 'LOCATION_SYNC_DATA') {
    const { location, authToken, hasuraUrl } = event.data;
    executeLocationUpdate(location, authToken, hasuraUrl).catch(() => undefined);
    return;
  }

  if (event.data?.type === 'AUTH_TOKEN_UPDATE') {
    storeAuthToken(event.data.token).catch(() => undefined);
  }
});

self.addEventListener('push', (event) => {
  let data = { title: 'Rendasua', body: '', url: '/' };
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }
  event.waitUntil(
    (async () => {
      try {
        await self.registration.showNotification(data.title || 'Rendasua', {
          body: data.body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          data: { url: data.url || '/', orderId: data.orderId },
          tag: data.orderId ? `order-${data.orderId}` : 'rendasua-notification',
          requireInteraction: true,
        });
      } catch (e) {
        // no-op
      }
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        if (clientList.length > 0) {
          clientList[0].focus();
          clientList[0].navigate(url);
        } else if (self.clients.openWindow) {
          self.clients.openWindow(url);
        }
      })
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(handleLocationSync());
  }
});

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
      body: JSON.stringify({ query: mutation, variables }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (result.errors) {
      const msg = result.errors[0]?.message || '';
      throw new Error(msg);
    }

    return true;
  } catch (error) {
    const message = error?.message || '';
    const isFkOrInvalid =
      message.includes('foreign key') || message.includes('violates foreign key');

    if (isFkOrInvalid) {
      try {
        const clients = await self.clients.matchAll({ includeUncontrolled: true });
        clients.forEach((client) => client.postMessage({ type: 'CLEAR_STORED_LOCATION' }));
      } catch (e) {
        // no-op
      }
    }
    return false;
  }
}

async function handleLocationSync() {
  try {
    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    if (clients.length === 0) return;

    clients[0].postMessage({ type: 'REQUEST_LOCATION_SYNC' });
  } catch (error) {
    // no-op
  }
}

async function storeAuthToken(token) {
  try {
    const db = await openAuthDB();
    if (!db) return;
    const transaction = db.transaction(['tokens'], 'readwrite');
    const store = transaction.objectStore('tokens');
    await store.put({ id: 'auth_token', value: token });
  } catch (error) {
    // no-op
  }
}

function openAuthDB() {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open('rendasua-auth', 1);
      request.onerror = () => resolve(null);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('tokens')) {
          db.createObjectStore('tokens', { keyPath: 'id' });
        }
      };
    } catch (error) {
      resolve(null);
    }
  });
}

