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

export const sendNotification = (title, options = {}) => {
  if (!('Notification' in window)) {
    return;
  }

  if (Notification.permission === 'granted') {
    const defaultOptions = {
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
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
