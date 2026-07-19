import { precacheAndRoute } from 'workbox-precaching';

// Precaching automatically injected by vite-plugin-pwa
precacheAndRoute(self.__WB_MANIFEST);

// Handle Push Events
self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      const data = event.data.json();
      const options = {
        body: data.body || 'Du har en ny notis',
        icon: '/pwa-192x192.png',
        data: {
          url: data.url || '/'
        }
      };
      event.waitUntil(
        self.registration.showNotification(data.title || 'RSS Bevakare', options)
      );
    } catch(e) {
      // Fallback if not json
      event.waitUntil(
        self.registration.showNotification('RSS Bevakare', {
          body: event.data.text(),
          icon: '/pwa-192x192.png'
        })
      );
    }
  }
});

// Handle Notification Clicks
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  } else {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Handle skipWaiting from PWABadge
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
