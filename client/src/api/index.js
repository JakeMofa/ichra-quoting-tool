// client/src/api/index.js
// Thin, dependable wrappers around backend endpoints.
// Uses fetch with a small timeout + consistent error handling.

const BASE = (process.env.REACT_APP_API || 'http://localhost:5050/api').replace(/\/+$/, '');

// --- low-level helpers -------------------------------------------------------
function withTimeout(ms, promise) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return Promise.race([
    promise(ctrl.signal),
    new Promise((_, rej) => setTimeout(() => rej(new Error('Request timed out')), ms + 10)),
  ]).finally(() => clearTimeout(t));
}

async function request(method, path, body) {
  const url = `${BASE}${path}`;
  return withTimeout(20000, async (signal) => {
    const res = await fetch(url, {
      method,
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { /* noop */ }
    if (!res.ok) {
      const msg = data?.error?.message || data?.message || text || `${res.status} ${res.statusText}`;
      throw new Error(msg);
    }
    return data;
  });
}

// For GET querystrings that accept comma-separated arrays.
function toQuery(obj = {}) {
  const params = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => {
    if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) return;
    if (Array.isArray(v)) params.set(k, v.join(','));
    else params.set(k, String(v));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

// Normalize filters into what the backend expects for POST /summary/employees
export function normalizeFilters(f = {}) {
  return {
    carrier: Array.isArray(f.carrier) && f.carrier.length ? f.carrier : undefined,
    level: Array.isArray(f.level) && f.level.length ? f.level : undefined,
    on_market: typeof f.on_market === 'boolean' ? f.on_market : undefined,
  };
}

// --- exported API surface -----------------------------------------------------
export const api = {
  // Health
  ping: () => request('GET', `/ping`),

  // Groups
  createGroup: (payload) =>
    request('POST', `/groups`, payload),             // returns { group: {...} }
  getGroup: (groupId) =>
    request('GET', `/groups/${groupId}`),
  listGroups: () =>
    request('GET', `/groups`),

  // Group deletion (shallow/cascade + dry-run)
  deleteGroup: (groupId, { mode = 'shallow', dry_run = false } = {}) =>
    request('DELETE', `/groups/${groupId}?mode=${encodeURIComponent(mode)}&dry_run=${dry_run ? 'true' : 'false'}`),
  previewDeleteGroup: (groupId) =>
    request('DELETE', `/groups/${groupId}?mode=cascade&dry_run=true`),

  // Quotes (batch runs on quotes page, not on members page)
  runQuotes: (groupId, payload) =>
    request('POST', `/groups/${groupId}/quotes`, payload),
  previewQuotes: (groupId, payload) =>
    request('POST', `/groups/${groupId}/quotes/preview`, payload),
  quotesLatest: (groupId) =>
    request('GET', `/groups/${groupId}/quotes`),
  quotesHistory: (groupId) =>
    request('GET', `/groups/${groupId}/quotes/history`),
  benchmarkSLCSP: (groupId, payload) =>
    request('POST', `/groups/${groupId}/quotes/benchmark`, payload),

  // Summaries & facets
  filters: (groupId) =>
    request('GET', `/groups/${groupId}/summary/employees/filters`),
  employerSummary: (groupId) =>
    request('GET', `/groups/${groupId}/summary/employer`),
  employeesSummaryGET: (groupId, filtersGET = {}) =>
    request('GET', `/groups/${groupId}/summary/employees${toQuery(filtersGET)}`),
  employeesSummaryPOST: (groupId, filtersPOST = {}, selected = undefined) =>
    request('POST', `/groups/${groupId}/summary/employees`, { filters: filtersPOST, selected }),

  // Members
  listMembers: (groupId) =>
    request('GET', `/groups/${groupId}/members`),
  getMember: (groupId, memberId) =>
    request('GET', `/groups/${groupId}/members/${memberId}`),
  createMember: (groupId, body) =>
    request('POST', `/groups/${groupId}/members`, body),
  updateMember: (groupId, memberId, patch) =>
    request('PATCH', `/groups/${groupId}/members/${memberId}`, patch),
  deleteMember: (groupId, memberId) =>
    request('DELETE', `/groups/${groupId}/members/${memberId}`),

  // Classes
  listClasses: (groupId) =>
    request('GET', `/groups/${groupId}/classes`),
  createClass: (groupId, body) =>
    request('POST', `/groups/${groupId}/classes`, body),
  updateClass: (groupId, classId, patch) =>
    request('PATCH', `/groups/${groupId}/classes/${classId}`, patch),
  deleteClass: (groupId, classId) =>
    request('DELETE', `/groups/${groupId}/classes/${classId}`),

  // Dependents (per-dependent CRUD)
  updateDependent: (groupId, memberId, depId, patch) =>
    request('PATCH', `/groups/${groupId}/members/${memberId}/dependents/${depId}`, patch),
  deleteDependent: (groupId, memberId, depId) =>
    request('DELETE', `/groups/${groupId}/members/${memberId}/dependents/${depId}`),

  // Step 4: per-member ICHRA (run before navigating to Quotes)
  runMemberIchra: (groupId, memberId, payload) =>
    request('POST', `/groups/${groupId}/members/${memberId}/ichra`, payload),
};