// Service worker нужен только для уведомлений Windows с кнопками действий.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('notificationclick', (event) => {
  const action = event.action || 'open';
  const id = event.notification.data && event.notification.data.id;
  event.notification.close();

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (windows.length === 0) {
        const url = action === 'open' ? '/' : `/?action=${encodeURIComponent(action)}&id=${encodeURIComponent(id)}`;
        await self.clients.openWindow(url);
        return;
      }
      windows.forEach((w) => w.postMessage({ type: 'notification-action', action, id }));
      if (action === 'open') await windows[0].focus();
    })(),
  );
});
