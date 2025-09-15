// client/src/api/counties.js
// If the backend exposes GET /counties?ids=41051,41067 return that mapping.
// If not, we gracefully fall back to showing the raw IDs.

import { authFetch } from './authHeaders';

const BASE = (process.env.REACT_APP_API || 'http://localhost:5050/api').replace(/\/+$/, '');
const cache = new Map(); // id -> name

export async function getCountyNamesByIds(ids = []) {
  const need = ids.filter((id) => !cache.has(id));
  if (need.length === 0) {
    return Object.fromEntries(ids.map((id) => [id, cache.get(id)]));
  }

  try {
    const qs = new URLSearchParams({ ids: need.join(',') }).toString();
    const res = await authFetch(`${BASE}/counties?${qs}`);
    if (!res.ok) throw new Error('No /counties endpoint');
    const data = await res.json(); // { "41051": "Multnomah County, OR", ... }
    Object.entries(data || {}).forEach(([id, name]) => cache.set(id, name));
  } catch {
    need.forEach((id) => cache.set(id, id));
  }

  return Object.fromEntries(ids.map((id) => [id, cache.get(id)]));
}

// this is for selecting which county
export async function getCountyCandidatesByZip(zip) {
  if (!zip) return { ids: [], map: {} };
  try {
    const res = await authFetch(`${BASE}/counties?zip=${encodeURIComponent(zip)}`);
    if (!res.ok) throw new Error('no endpoint');
    const data = await res.json(); // expected: { ids: [...], map: {...} }
    return {
      ids: Array.isArray(data?.ids) ? data.ids : [],
      map: data?.map || {},
    };
  } catch {
    return { ids: [], map: {} }; // gracefully fallback → manual entry
  }
}