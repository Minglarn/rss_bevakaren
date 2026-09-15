import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

// Hjälpfunktion för att kontrollera om en JWT-token har passerat sitt bäst-före-datum
export const isTokenExpired = (token) => {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload.exp) return false;
    // Buffert på 10 sekunder
    return Date.now() >= (payload.exp * 1000 - 10000);
  } catch (e) {
    return true;
  }
};

// Hjälpfunktion för att kontrollera om token bör förnyas (t.ex. om halva tiden har gått)
export const shouldRefreshToken = (token) => {
  if (!token) return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload.exp || !payload.iat) return false;
    const totalLifetime = payload.exp - payload.iat;
    const elapsed = (Date.now() / 1000) - payload.iat;
    // Förnya om mer än 20% av tiden har passerat (eller mer än 3 dagar för 30-dagarstoken)
    return elapsed > Math.min(totalLifetime * 0.2, 3 * 24 * 3600);
  } catch (e) {
    return false;
  }
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const deviceId = localStorage.getItem('rss_device_id');
  if (deviceId) {
    config.headers['X-Device-Id'] = deviceId;
  }
  return config;
});

// Global respons-interceptor för att hantera utgångna eller ogiltiga sessioner
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const isLoginRequest = error.config && error.config.url && error.config.url.includes('/token');
      // Om det inte är själva inloggningsformuläret som avvisades med fel lösenord:
      if (!isLoginRequest) {
        const hadToken = !!localStorage.getItem('token');
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('rss_prio_enabled');
        if (hadToken) {
          window.dispatchEvent(new CustomEvent('sessionExpired', { detail: { status: 401 } }));
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

