// client/src/api/counties.js
// If the backend exposes GET /counties?ids=41051,41067 return that mapping.
// If not, we gracefully fall back to showing the raw IDs.

const BASE = (process.env.REACT_APP_API || 'http://localhost:5050/api').replace(/\/+$/, '');
const cache = new Map(); // id -> name

export async function getCountyNamesByIds(ids = []) {
  const need = ids.filter((id) => !cache.has(id));
  // If everything is cached, return immediately.
  if (need.length === 0) {
    return Object.fromEntries(ids.map((id) => [id, cache.get(id)]));
  }

  try {
    const qs = new URLSearchParams({ ids: need.join(',') }).toString();
    const res = await fetch(`${BASE}/counties?${qs}`);
    if (!res.ok) throw new Error('No /counties endpoint');
    const data = await res.json(); // expected shape: { "41051": "Multnomah County, OR", ... }
    Object.entries(data || {}).forEach(([id, name]) => cache.set(id, name));
  } catch {
    // Fallback: store the ID as the display label
    need.forEach((id) => cache.set(id, id));
  }

  return Object.fromEntries(ids.map((id) => [id, cache.get(id)]));
}

// this is for selecting which county
export async function getCountyCandidatesByZip(zip) {
    if (!zip) return { ids: [], map: {} };
    try {
      const res = await fetch(`${BASE}/counties?zip=${encodeURIComponent(zip)}`);
      if (!res.ok) throw new Error('no endpoint');
      const data = await res.json(); // expected: { ids: ["41051","41067"], map: { "41051":"Multnomah County, OR", ... } }
      return {
        ids: Array.isArray(data?.ids) ? data.ids : [],
        map: data?.map || {},
      };
    } catch {
      return { ids: [], map: {} }; // gracefully fallback → manual entry
    }
  }
  