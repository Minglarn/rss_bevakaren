/**
 * Sessionshantering och applikationsläge för RSS-Bevakaren.
 *
 * Hanterar:
 * 1. Applikationsläge: 'omni' (standard, Nyhetsbevakare) vs 'classic' (Klassisk RSS-läsare).
 * 2. Automatisk sessionsspårning för 'Nya sedan sist' med 30 minuters inaktivitetströskel.
 */

const APP_MODE_KEY = 'rss_app_mode';
const SESSION_REF_TIME_KEY = 'rss_session_ref_time';
const SESSION_LAST_ACTIVE_KEY = 'rss_session_last_active';
const SESSION_TIMEOUT_SECONDS = 1800; // 30 minuter

/**
 * Hämtar nuvarande applikationsläge.
 * Standard är 'omni' (Nyhetsbevakare).
 */
export const getAppMode = () => {
  const mode = localStorage.getItem(APP_MODE_KEY);
  if (mode === 'classic') {
    return 'classic';
  }
  return 'omni';
};

/**
 * Uppdaterar applikationsläge och meddelar lyssnare.
 */
export const setAppMode = (mode) => {
  const validMode = mode === 'classic' ? 'classic' : 'omni';
  localStorage.setItem(APP_MODE_KEY, validMode);
  window.dispatchEvent(new CustomEvent('appModeChanged', { detail: { mode: validMode } }));
  return validMode;
};

/**
 * Initierar sessionsspårning vid start av applikationen.
 * Om mer än 30 minuter förflutit sedan förra aktiviteten betraktas detta som ett nytt besök,
 * varvid föregående aktivitetstid sätts som referenstid ('sedan sist').
 */
export const initSessionTracker = () => {
  const now = Math.floor(Date.now() / 1000);
  const lastActive = parseInt(localStorage.getItem(SESSION_LAST_ACTIVE_KEY) || '0', 10);
  let refTime = parseInt(localStorage.getItem(SESSION_REF_TIME_KEY) || '0', 10);

  // Ny session om det är första besöket eller mer än SESSION_TIMEOUT_SECONDS inaktivitet
  if (!refTime || (lastActive > 0 && (now - lastActive) > SESSION_TIMEOUT_SECONDS)) {
    if (lastActive > 0) {
      refTime = lastActive;
    } else {
      // Första besöket: sätt referenstid till 12 timmar bakåt
      refTime = Math.max(0, now - (12 * 3600));
    }
    localStorage.setItem(SESSION_REF_TIME_KEY, String(refTime));
  }

  // Uppdatera senaste aktivitet till nu
  localStorage.setItem(SESSION_LAST_ACTIVE_KEY, String(now));
  return refTime;
};

/**
 * Uppdaterar användarens senaste aktivitetstid utan att ändra 'sedan sist'-referensen under aktiv session.
 */
export const touchSession = () => {
  const now = Math.floor(Date.now() / 1000);
  localStorage.setItem(SESSION_LAST_ACTIVE_KEY, String(now));
};

/**
 * Hämtar referenstidpunkten (i unix-sekunder) för vad som räknas som 'sedan sist'.
 */
export const getSessionRefTime = () => {
  let refTime = parseInt(localStorage.getItem(SESSION_REF_TIME_KEY) || '0', 10);
  if (!refTime) {
    refTime = initSessionTracker();
  }
  return refTime;
};
