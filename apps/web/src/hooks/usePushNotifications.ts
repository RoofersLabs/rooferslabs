import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api-client';

type PushStatus =
  | 'unsupported' // browser has no Push API, or the server has no VAPID keys
  | 'loading'
  | 'denied' // user blocked notifications in the browser
  | 'unsubscribed'
  | 'subscribed';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Web Push subscription state + actions for the current browser. The service
 * worker (registered by vite-plugin-pwa) displays the pushes; this hook only
 * manages the subscription lifecycle against the backend.
 */
export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>('loading');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function detect() {
      if (!isPushSupported()) {
        setStatus('unsupported');
        return;
      }
      try {
        const { enabled } = await api.get<{ publicKey: string | null; enabled: boolean }>(
          '/notifications/push/public-key',
        );
        if (cancelled) return;
        if (!enabled) {
          setStatus('unsupported');
          return;
        }
        if (Notification.permission === 'denied') {
          setStatus('denied');
          return;
        }
        const registration = await navigator.serviceWorker.getRegistration();
        const subscription = await registration?.pushManager.getSubscription();
        if (!cancelled) setStatus(subscription ? 'subscribed' : 'unsubscribed');
      } catch {
        if (!cancelled) setStatus('unsupported');
      }
    }

    void detect();
    return () => {
      cancelled = true;
    };
  }, []);

  const subscribe = useCallback(async (): Promise<boolean> => {
    setBusy(true);
    try {
      const { publicKey } = await api.get<{ publicKey: string | null }>(
        '/notifications/push/public-key',
      );
      if (!publicKey) return false;

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'unsubscribed');
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;
      await api.post('/notifications/push/subscriptions', {
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        userAgent: navigator.userAgent.slice(0, 256),
      });
      setStatus('subscribed');
      return true;
    } catch {
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const unsubscribe = useCallback(async (): Promise<void> => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await api.post('/notifications/push/unsubscribe', { endpoint }).catch(() => undefined);
      }
      setStatus('unsubscribed');
    } finally {
      setBusy(false);
    }
  }, []);

  return { status, busy, subscribe, unsubscribe };
}
