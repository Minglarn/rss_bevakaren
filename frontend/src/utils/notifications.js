import api from '../api';

export function getDeviceId() {
  let devId = localStorage.getItem('rss_device_id');
  if (!devId) {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      devId = crypto.randomUUID();
    } else {
      devId = 'dev-' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    }
    localStorage.setItem('rss_device_id', devId);
  }
  return devId;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }

  let permission = Notification.permission;

  if (permission !== 'granted') {
    permission = await Notification.requestPermission();
  }

  return permission === 'granted';
};

export const checkPushSubscriptionStatus = async () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }
  if (localStorage.getItem('rss_push_unsubscribed') === 'true') {
    return false;
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    // Om subscription saknas i webbläsaren men användaren tidigare haft det aktiverat:
    if (!subscription && localStorage.getItem('rss_push_enabled') === 'true') {
      return await autoSyncPushSubscription({ force: true });
    }
    
    return !!subscription;
  } catch (e) {
    return false;
  }
};

export const subscribeToWebPush = async () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  try {
    const vapidRes = await api.get('/push/vapid-public-key');
    const publicVapidKey = vapidRes?.data?.public_key;
    if (!publicVapidKey) return null;

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    const savedVapidKey = localStorage.getItem('rss_push_vapid_key');
    const deviceId = getDeviceId();

    // Om nyckeln har ändrats på servern, avregistrera den gamla
    if (subscription && savedVapidKey && savedVapidKey !== publicVapidKey) {
      try {
        await subscription.unsubscribe();
        subscription = null;
      } catch (unsubErr) {
        console.warn('Could not cleanly unsubscribe previous token:', unsubErr);
      }
    }

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
      });
    }

    const subJSON = subscription.toJSON();
    if (subJSON && subJSON.endpoint && subJSON.keys) {
      await api.post('/push/subscribe', {
        endpoint: subJSON.endpoint,
        p256dh: subJSON.keys.p256dh,
        auth: subJSON.keys.auth,
        device_id: deviceId
      });
    }
    
    localStorage.setItem('rss_push_endpoint', subscription.endpoint);
    localStorage.setItem('rss_push_vapid_key', publicVapidKey);
    localStorage.setItem('rss_push_last_synced_at', String(Date.now()));
    localStorage.removeItem('rss_push_unsubscribed');
    localStorage.setItem('rss_push_enabled', 'true');
    return subJSON?.endpoint || subscription.endpoint;
  } catch (error) {
    console.error('Could not subscribe to push:', error);
    return null;
  }
};

let isAutoSyncing = false;

export const autoSyncPushSubscription = async ({ force = false } = {}) => {
  if (isAutoSyncing) {
    return false;
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }
  if (localStorage.getItem('rss_push_unsubscribed') === 'true') {
    return false;
  }

  isAutoSyncing = true;

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    const previouslyEnabled = localStorage.getItem('rss_push_enabled') === 'true';
    if (!subscription && !previouslyEnabled) {
      return false;
    }

    const savedEndpoint = localStorage.getItem('rss_push_endpoint');
    const savedVapidKey = localStorage.getItem('rss_push_vapid_key');
    const lastSyncedAt = Number(localStorage.getItem('rss_push_last_synced_at') || 0);
    const isRecent = Date.now() - lastSyncedAt < 24 * 60 * 60 * 1000; // 24 timmar

    // Snabbverifiering: Om vi redan har aktiv prenumeration och nyligen synkat mot servern,
    // görs inget serveranrop (undviker onödig trafik vid pull-to-refresh).
    if (subscription && !force && isRecent && savedEndpoint === subscription.endpoint && savedVapidKey) {
      return true;
    }

    const vapidRes = await api.get('/push/vapid-public-key');
    const publicVapidKey = vapidRes?.data?.public_key;
    if (!publicVapidKey) return false;

    const deviceId = getDeviceId();

    // Fall 1: VAPID-nyckeln på servern har roterats/bytts
    if (subscription && savedVapidKey && savedVapidKey !== publicVapidKey) {
      try {
        await subscription.unsubscribe();
      } catch (e) {
        console.warn('AutoSync: Unsubscribe old token failed:', e);
      }
      subscription = null;
    }

    // Fall 2: Prenumeration saknas i webbläsaren efter uppdatering
    if (!subscription) {
      const serverKeyArray = urlBase64ToUint8Array(publicVapidKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: serverKeyArray
      });
    }

    if (subscription) {
      const subJSON = subscription.toJSON();
      if (subJSON && subJSON.endpoint && subJSON.keys) {
        await api.post('/push/subscribe', {
          endpoint: subJSON.endpoint,
          p256dh: subJSON.keys.p256dh,
          auth: subJSON.keys.auth,
          device_id: deviceId
        });
      }
      localStorage.setItem('rss_push_endpoint', subscription.endpoint);
      localStorage.setItem('rss_push_vapid_key', publicVapidKey);
      localStorage.setItem('rss_push_last_synced_at', String(Date.now()));
      localStorage.removeItem('rss_push_unsubscribed');
      localStorage.setItem('rss_push_enabled', 'true');
      return true;
    }
  } catch (err) {
    console.warn('Silent autoSyncPushSubscription error:', err);
  } finally {
    isAutoSyncing = false;
  }
  return false;
};

export const sendNotification = (title, options = {}) => {
  if (!('Notification' in window)) {
    return;
  }

  if (Notification.permission === 'granted') {
    const defaultOptions = {
      icon: '/pwa-192x192.png?v=2026.09.09.03',
      badge: '/badge.png?v=2026.09.09.03'
    };
    
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        registration.showNotification(title, { ...defaultOptions, ...options }).catch(e => {
          console.error("Could not show SW notification", e);
          new Notification(title, { ...defaultOptions, ...options });
        });
      });
    } else {
      new Notification(title, { ...defaultOptions, ...options });
    }
  }
};
