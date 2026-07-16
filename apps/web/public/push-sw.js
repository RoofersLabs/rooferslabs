/**
 * Web Push handlers, imported into the generated Workbox service worker via
 * vite-plugin-pwa `importScripts`. Payload shape: { title, message, url, priority }
 * (see apps/api PushService).
 */
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { message: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'RoofersLabs';
  const options = {
    body: payload.message || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.url || 'rooferslabs',
    data: { url: payload.url || '/notifications' },
    // Emergencies stay on screen until the owner interacts with them.
    requireInteraction: payload.priority === 'CRITICAL',
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/notifications';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
