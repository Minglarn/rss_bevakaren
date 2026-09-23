/**
 * Sessionshantering och applikationsläge för RSS-Bevakaren.
 *
 * Hanterar:
 * 1. Applikationsläge: 'omni' (standard, Nyhetsbevakare) vs 'classic' (Klassisk RSS-läsare).
 * 2. Automatisk sessionsspårning för 'Nya sedan sist' med 30 minuters inaktivitetströskel.
 * 3. Persistering av sedda artiklar under pågående session över skärmuppdatering (pull-to-refresh).
 */

const APP_MODE_KEY = 'rss_app_mode';
const SESSION_REF_TIME_KEY = 'rss_session_ref_time';
const SESSION_LAST_ACTIVE_KEY = 'rss_session_last_active';
const SESSION_SEEN_KEY = 'rss_session_seen_articles';
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

// Lokalt minne för sedda artiklar under pågående flik/session
const activeSessionSeenSet = new Set();

/**
 * Hjälpfunktion för att hämta persisterat tillstånd från sessionStorage.
 */
const getStoredSeenState = () => {
  try {
    const raw = sessionStorage.getItem(SESSION_SEEN_KEY);
    if (!raw) return { refTime: 0, ids: [] };
    const parsed = JSON.parse(raw);
    return {
      refTime: Number(parsed.refTime) || 0,
      ids: Array.isArray(parsed.ids) ? parsed.ids : []
    };
  } catch (e) {
    return { refTime: 0, ids: [] };
  }
};

/**
 * Hjälpfunktion för att spara sedda artiklar till sessionStorage knutet till aktuell referenstid.
 */
const saveSeenStateToStorage = () => {
  try {
    const refTime = parseInt(localStorage.getItem(SESSION_REF_TIME_KEY) || '0', 10);
    if (refTime > 0) {
      sessionStorage.setItem(SESSION_SEEN_KEY, JSON.stringify({
        refTime,
        ids: Array.from(activeSessionSeenSet)
      }));
    }
  } catch (e) {}
};

/**
 * Hämtar mängden av artikel-ID:n som setts under innevarande session.
 * Synkar automatiskt med sessionStorage om minnet är tomt men samma session pågår (t.ex. efter pull-to-refresh).
 */
export const getSeenArticleIds = () => {
  const refTime = parseInt(localStorage.getItem(SESSION_REF_TIME_KEY) || '0', 10);
  if (activeSessionSeenSet.size === 0 && refTime > 0) {
    const stored = getStoredSeenState();
    if (stored.refTime === refTime && stored.ids.length > 0) {
      stored.ids.forEach(id => activeSessionSeenSet.add(id));
    }
  }
  return new Set(activeSessionSeenSet);
};

/**
 * Lägger till ett artikel-ID som sett under sessionen.
 */
export const addSeenArticleId = (id) => {
  if (!id) return;
  activeSessionSeenSet.add(id);
  saveSeenStateToStorage();
};

/**
 * Rensar listan över sedda artiklar för sessionen.
 */
export const clearSeenArticleIds = () => {
  activeSessionSeenSet.clear();
  try {
    sessionStorage.removeItem(SESSION_SEEN_KEY);
  } catch (e) {}
};

/**
 * Nollställer eller flyttar fram sessionsreferensen till nuvarande tidpunkt (eller angiven timestamp).
 * Skickar eventet 'sessionRefChanged' för omedelbar realtidssynk i hela gränssnittet.
 */
export const resetSessionRef = (customTime = null) => {
  const now = Math.floor(Date.now() / 1000);
  const newRefTime = customTime || now;
  clearSeenArticleIds();
  localStorage.setItem(SESSION_REF_TIME_KEY, String(newRefTime));
  localStorage.setItem(SESSION_LAST_ACTIVE_KEY, String(now));
  window.dispatchEvent(new CustomEvent('sessionRefChanged', { detail: { refTime: newRefTime } }));
  return newRefTime;
};

/**
 * Initierar sessionsspårning vid start av applikationen.
 * Om mer än 30 minuter förflutit sedan förra aktiviteten betraktas detta som ett nytt besök,
 * varvid föregående aktivitetstid sätts som referenstid ('sedan sist').
 * Vid aktiv session bibehålls sedda artiklar från sessionStorage.
 */
export const initSessionTracker = () => {
  const now = Math.floor(Date.now() / 1000);
  const lastActive = parseInt(localStorage.getItem(SESSION_LAST_ACTIVE_KEY) || '0', 10);
  let refTime = parseInt(localStorage.getItem(SESSION_REF_TIME_KEY) || '0', 10);

  // Ny session om det är första besöket eller mer än SESSION_TIMEOUT_SECONDS inaktivitet
  if (!refTime || (lastActive > 0 && (now - lastActive) > SESSION_TIMEOUT_SECONDS)) {
    clearSeenArticleIds();
    if (lastActive > 0) {
      // Begränsa 'sedan sist' till max 4 timmar bakåt så vi inte samlar flera dygns historik som "nya"
      refTime = Math.max(lastActive, now - 14400);
    } else {
      // Första besöket: starta med nuvarande tid så vi inte samlar på oss ett helt dygns historik
      refTime = now;
    }
    localStorage.setItem(SESSION_REF_TIME_KEY, String(refTime));
    window.dispatchEvent(new CustomEvent('sessionRefChanged', { detail: { refTime } }));
  } else {
    // Samma aktiva session (t.ex. vid skärmuppdatering / pull-to-refresh):
    // Återställ sedda artiklar från sessionStorage så att de inte återuppstår som "NY"
    const stored = getStoredSeenState();
    if (stored.refTime === refTime && stored.ids.length > 0) {
      activeSessionSeenSet.clear();
      stored.ids.forEach(id => activeSessionSeenSet.add(id));
    }
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
