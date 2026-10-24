const CACHE_NAME = 'fitpulse-shell-v1';
const APP_SHELL = ['/', '/dashboard.html', '/planner.html', '/css/style.css', '/js/pwa.js'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard.html';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => new URL(client.url).pathname === url);
    return existing ? existing.focus() : clients.openWindow(url);
  }));
});
