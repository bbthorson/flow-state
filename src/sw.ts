/// <reference lib="webworker" />

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { IndexedDBStorage } from '@flowstate/runtime';
import { handlePushPayload } from './sw-push';

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('push', (event) => {
  const payload = (() => {
    try {
      return event.data?.json();
    } catch {
      const text = event.data?.text();
      return text ? { type: 'hub.push.text', title: 'Flow State', body: text, payload: { text } } : null;
    }
  })();

  if (!payload) return;

  event.waitUntil(
    handlePushPayload(payload, {
      storage: new IndexedDBStorage(),
      showNotification: (title, options) => self.registration.showNotification(title, options),
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients[0];
      if (existing && 'focus' in existing) {
        return existing.focus();
      }
      return self.clients.openWindow('/');
    }),
  );
});
