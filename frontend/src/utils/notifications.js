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
    console.log('Denna webbläsare stöder inte skrivbordsnotiser');
    return false;
  }

  let permission = Notification.permission;

  if (permission !== 'granted') {
    permission = await Notification.requestPermission();
  }

  return permission === 'granted';
};

export const subscribeToWebPush = async () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  try {
    const vapidRes = await api.get('/push/vapid-public-key');
    const publicVapidKey = vapidRes.data.public_key;

    const registration = await navigator.serviceWorker.ready;
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
    
    return true;
  } catch (error) {
    console.error('Kunde inte prenumerera på push:', error);
    return false;
  }
};

export const sendNotification = (title, options = {}) => {
  if (!('Notification' in window)) {
    return;
  }

  if (Notification.permission === 'granted') {
    const defaultOptions = {
      icon: '/pwa-192x192.png',
    };
    
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        registration.showNotification(title, { ...defaultOptions, ...options }).catch(e => {
          console.error("Kunde inte visa SW-notis", e);
          new Notification(title, { ...defaultOptions, ...options });
        });
      });
    } else {
      new Notification(title, { ...defaultOptions, ...options });
    }
  }
};
