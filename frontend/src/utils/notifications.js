import api from '../api';

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
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
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
    const publicVapidKey = vapidRes.data.public_key;

    const registration = await navigator.serviceWorker.ready;
    
    // Rensa eventuell aldre prenumerationstoken sa att nyckeln garanterat matchar servern
    const existingSub = await registration.pushManager.getSubscription();
    if (existingSub) {
      try {
        await existingSub.unsubscribe();
      } catch (unsubErr) {
        console.warn('Could not cleanly unsubscribe previous token:', unsubErr);
      }
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
    });

    const subJSON = subscription.toJSON();
    await api.post('/push/subscribe', {
      endpoint: subJSON.endpoint,
      p256dh: subJSON.keys.p256dh,
      auth: subJSON.keys.auth
    });
    
    localStorage.removeItem('rss_push_unsubscribed');
    localStorage.setItem('rss_push_enabled', 'true');
    return subJSON.endpoint;
  } catch (error) {
    console.error('Could not subscribe to push:', error);
    return null;
  }
};

export const autoSyncPushSubscription = async () => {
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
    let subscription = await registration.pushManager.getSubscription();

    // Om ingen prenumeration finns och anvandaren aldrig haft det aktiverat, avbryt
    if (!subscription && localStorage.getItem('rss_push_enabled') !== 'true') {
      return false;
    }

    const vapidRes = await api.get('/push/vapid-public-key');
    const publicVapidKey = vapidRes?.data?.public_key;
    if (!publicVapidKey) return false;

    const serverKeyArray = urlBase64ToUint8Array(publicVapidKey);

    let needsResubscribe = false;
    if (!subscription) {
      needsResubscribe = true;
    } else if (subscription.options && subscription.options.applicationServerKey) {
      const subKey = new Uint8Array(subscription.options.applicationServerKey);
      if (subKey.length !== serverKeyArray.length) {
        needsResubscribe = true;
      } else {
        for (let i = 0; i < subKey.length; i++) {
          if (subKey[i] !== serverKeyArray[i]) {
            needsResubscribe = true;
            break;
          }
        }
      }
    }

    if (needsResubscribe) {
      if (subscription) {
        try {
          await subscription.unsubscribe();
        } catch (e) {
          console.warn('AutoSync: Unsubscribe old token failed:', e);
        }
      }
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
          auth: subJSON.keys.auth
        });
      }
      localStorage.removeItem('rss_push_unsubscribed');
      localStorage.setItem('rss_push_enabled', 'true');
      return true;
    }
  } catch (err) {
    console.warn('Silent autoSyncPushSubscription error:', err);
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
