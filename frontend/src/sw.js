import { precacheAndRoute } from 'workbox-precaching';

// Precaching automatically injected by vite-plugin-pwa
precacheAndRoute(self.__WB_MANIFEST);

const DB_NAME = 'rss_bevakare_db';
const STORE_NAME = 'auth_store';

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getToken() {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get('jwt_token');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch(e) {
    console.error("Token DB error", e);
    return null;
  }
}

async function setToken(token) {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(token, 'jwt_token');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error("Failed to set token", e);
  }
}

// Handle Push Events
self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      const data = event.data.json();
      const options = {
        body: data.body || 'You have a new notification',
        icon: '/pwa-192x192.png',
        data: {
          url: data.url || '/',
          article_id: data.article_id
        },
        actions: [
          { action: 'mark_read', title: 'Mark as Read' },
          { action: 'open_event', title: 'Open Event' }
        ]
      };
      event.waitUntil(
        self.registration.showNotification(data.title || 'RSS Monitor', options)
      );
    } catch(e) {
      // Fallback if not json
      event.waitUntil(
        self.registration.showNotification('RSS Monitor', {
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
  
  if (event.action === 'mark_read') {
    if (event.notification.data && event.notification.data.article_id) {
      event.waitUntil((async () => {
        const token = await getToken();
        if (token) {
          try {
            await fetch(`/api/articles/${event.notification.data.article_id}/read`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
          } catch(e) {
            console.error("Failed to mark as read", e);
          }
        }
      })());
    }
  } else if (event.action === 'open_event') {
    if (event.notification.data && event.notification.data.url) {
      event.waitUntil(clients.openWindow(event.notification.data.url));
    } else {
      event.waitUntil(clients.openWindow('/'));
    }
  } else {
    // Default action
    if (event.notification.data && event.notification.data.url) {
      event.waitUntil(clients.openWindow(event.notification.data.url));
    } else {
      event.waitUntil(clients.openWindow('/'));
    }
  }
});

// Handle messages
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data && event.data.type === 'SET_TOKEN') {
    event.waitUntil(setToken(event.data.token));
  }
});
