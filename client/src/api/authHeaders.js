// client/src/api/authHeaders.js
// Read settings from localStorage and attach headers for every request.

export function getAuthHeadersFromStorage() {
    try {
      const s = JSON.parse(localStorage.getItem('demo:settings') || '{}');
      const headers = {};
      if (s?.mockMode) headers['X-Mock-Mode'] = '1';
      if (!s?.mockMode && s?.ideonKey) headers['X-Ideon-Key'] = s.ideonKey;
      return headers;
    } catch {
      return {};
    }
  }
  
  // Drop-in fetch wrapper you can use anywhere.
  export async function authFetch(input, init = {}) {
    const extra = getAuthHeadersFromStorage();
    const merged = {
      ...init,
      headers: { ...(init.headers || {}), ...extra },
    };
    return fetch(input, merged);
  }