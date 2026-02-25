import { useCallback, useEffect, useRef, useState } from 'react';
import { useApiClient } from './useApiClient';

export function usePushSubscription() {
  const apiClient = useApiClient();
  const [status, setStatus] = useState<'idle' | 'prompting' | 'subscribed' | 'unsupported' | 'denied' | 'error'>('idle');
  const hasSyncedThisSession = useRef(false);

  /** Sync existing subscription to backend without prompting. Call once after login when permission already granted. */
  const syncWhenGranted = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setStatus('unsupported');
      return;
    }
    if (Notification.permission !== 'granted') return;
    if (hasSyncedThisSession.current) return;
    try {
      if (sessionStorage.getItem('rendasua_push_synced') === '1') return;
    } catch {
      /* sessionStorage not available */
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      let sub = await registration.pushManager.getSubscription();

      if (!sub) {
        const publicKeyRes = await apiClient.get<{ publicKey: string }>('/notifications/vapid-public-key');
        const publicKey = publicKeyRes.data?.publicKey;
        if (!publicKey) return;
        sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      if (sub) {
        const json = sub.toJSON();
        const payload = {
          endpoint: json.endpoint,
          keys: {
            p256dh: json.keys?.p256dh ?? '',
            auth: json.keys?.auth ?? '',
          },
        };
        await apiClient.post('/notifications/push-subscribe', payload);
        hasSyncedThisSession.current = true;
        try {
          sessionStorage.setItem('rendasua_push_synced', '1');
        } catch {
          /* ignore */
        }
        setStatus('subscribed');
      }
    } catch (err) {
      console.warn('Push sync error:', err);
    }
  }, [apiClient]);

  const subscribe = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setStatus('unsupported');
      return;
    }

    if (Notification.permission === 'denied') {
      setStatus('denied');
      return;
    }

    setStatus('prompting');

    try {
      const registration = await navigator.serviceWorker.ready;
      let sub = await registration.pushManager.getSubscription();

      if (!sub) {
        const publicKeyRes = await apiClient.get<{ publicKey: string }>('/notifications/vapid-public-key');
        const publicKey = publicKeyRes.data?.publicKey;
        if (!publicKey) {
          setStatus('error');
          return;
        }
        sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      if (sub) {
        const json = sub.toJSON();
        const payload = {
          endpoint: json.endpoint,
          keys: {
            p256dh: json.keys?.p256dh ?? '',
            auth: json.keys?.auth ?? '',
          },
        };
        await apiClient.post('/notifications/push-subscribe', payload);
        hasSyncedThisSession.current = true;
        setStatus('subscribed');
      }
    } catch (err) {
      console.warn('Push subscription error:', err);
      if (Notification.permission === 'denied') setStatus('denied');
      else setStatus('error');
    }
  }, [apiClient]);

  useEffect(() => {
    if (!('Notification' in window) || !('PushManager' in window)) {
      setStatus('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setStatus('denied');
    }
  }, []);

  const requestAndSubscribe = useCallback(async () => {
    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      await subscribe();
    } else {
      setStatus('denied');
    }
  }, [subscribe]);

  return { status, subscribe: requestAndSubscribe, syncWhenGranted };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
