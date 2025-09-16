// Read settings + auth from localStorage and attach headers for every request.

// keys
const SETTINGS_KEY = "demo:settings"; // { mockMode, ideonKey }
const AUTH_KEY = "demo:auth";         // { token, email }

// --- core helpers ------------------------------------------------------------
function readJSON(key) {
  try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch { return {}; }
}

export function getAuthHeadersFromStorage() {
  const s = readJSON(SETTINGS_KEY);
  const a = readJSON(AUTH_KEY);

  const headers = {};
  // mock / ideon
  if (s?.mockMode) headers["X-Mock-Mode"] = "1";
  if (!s?.mockMode && s?.ideonKey) headers["X-Ideon-Key"] = String(s.ideonKey).trim();

  // JWT
  if (a?.token) headers["Authorization"] = `Bearer ${a.token}`;

  return headers;
}

// Drop-in fetch wrapper you can use anywhere.
export async function authFetch(input, init = {}) {
  const extra = getAuthHeadersFromStorage();
  const merged = { ...init, headers: { ...(init.headers || {}), ...extra } };
  return fetch(input, merged);
}

// Persist new settings into localStorage.
export function saveSettingsToStorage(next) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next || {})); } catch {}
}

// Optional: read the entire settings object (for UI context)
export function readSettingsFromStorage() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// --- auth storage helpers ----------------------------------------------------
export function saveAuthToStorage(next) {
  try { localStorage.setItem(AUTH_KEY, JSON.stringify(next || {})); } catch {}
}
export function readAuthFromStorage() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
export function clearAuthFromStorage() {
  try { localStorage.removeItem(AUTH_KEY); } catch {}
}