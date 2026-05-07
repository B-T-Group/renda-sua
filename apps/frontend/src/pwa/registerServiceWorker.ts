import { environment } from '../config/environment';

type RegisterCallbacks = {
  onUpdateReady?: () => void;
  onSuccess?: () => void;
};

export function registerServiceWorker(callbacks: RegisterCallbacks = {}) {
  if (!('serviceWorker' in navigator)) return;
  if (!environment.isProduction) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        callbacks.onSuccess?.();

        const maybeNotifyUpdate = () => {
          if (registration.waiting) {
            callbacks.onUpdateReady?.();
          }
        };

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;

          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed') {
              // If there is an existing controller, a new update is ready.
              if (navigator.serviceWorker.controller) {
                maybeNotifyUpdate();
              }
            }
          });
        });

        // In case an update is already waiting at load time.
        maybeNotifyUpdate();
      })
      .catch(() => {
        // no-op
      });
  });
}

export async function skipWaitingAndReload() {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;

  if (registration.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  const onControllerChange = () => {
    navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    window.location.reload();
  };

  navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
}

