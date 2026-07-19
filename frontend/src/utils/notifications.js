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
      icon: '/pwa-192x192.svg',
      badge: '/pwa-192x192.svg',
    };
    
    new Notification(title, { ...defaultOptions, ...options });
  }
};
