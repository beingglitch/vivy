/*
 * Vivy service worker.
 *
 * Its only job is push. There is no offline caching here on purpose: the app is
 * local-first through its own database (ADR 0001), and a service worker cache
 * layered on top would be a second, competing source of stale truth.
 *
 * Hand-written rather than generated, because it is forty lines and a build
 * plugin would hide exactly the behaviour worth reading.
 */

self.addEventListener('install', () => {
  // Take over immediately so the first reminder does not wait for a tab close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'Vivy', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Vivy';
  const options = {
    body: payload.body || '',
    // Tag collapses repeats: a second reminder for the same source replaces the
    // first rather than stacking up while the phone is in a pocket.
    tag: payload.tag || 'vivy',
    renotify: Boolean(payload.tag),
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: payload.url || '/' },
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Reuse an open Vivy tab if there is one, opening a duplicate is the
      // most common way push notifications feel broken.
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }));
});
