// server/services/ideon.js

// Notes:
// - BASE_URL: https://api.ideonapi.com   (no trailing /v6 in the URL)
// - ICHRA create is NESTED: POST /groups/{groupId}/ichra_affordability_calculations
// - addMember: POST /groups/{groupId}/members
// - Lightweight retry + throttle to respect ~100 rpm limit

require("dotenv").config();
const axios = require("axios");

// --- Config ---
const IDEON_API_KEY = process.env.IDEON_API_KEY || process.env.VERICRED_API_KEY || "";
const IDEON_BASE_URL = process.env.IDEON_BASE_URL || "https://api.ideonapi.com";

// Throttle: minimum delay between requests (ms). 700ms ≈ 85 req/min, safe under shared 100 rpm.
const MIN_DELAY_MS = Number(process.env.IDEON_MIN_DELAY_MS || 700);

// Retry/backoff for 429/5xx
const MAX_RETRIES = Number(process.env.IDEON_MAX_RETRIES || 3);
const INITIAL_BACKOFF_MS = Number(process.env.IDEON_INITIAL_BACKOFF_MS || 500);

// --- Axios instance ---
const api = axios.create({
  baseURL: IDEON_BASE_URL,
  headers: {
    // Ideon historically accepted "Vericred-Api-Key". Some envs allow "Ideon-Api-Key".
    // Sending both is harmless; server will ignore extras.
    "Vericred-Api-Key": IDEON_API_KEY,
    "Ideon-Api-Key": IDEON_API_KEY,
    "Authorization": `Bearer ${IDEON_API_KEY}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
    // Pin version so changes to default don’t surprise us.
    "Accept-Version": "v6",
  },
  timeout: 15000,
});

// --- Simple throttle (one request every MIN_DELAY_MS) ---
let lastRequestAt = 0;
async function throttle() {
  const now = Date.now();
  const wait = Math.max(0, lastRequestAt + MIN_DELAY_MS - now);
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastRequestAt = Date.now();
}

// --- Retry wrapper ---
async function requestWithRetry(fn, retries = MAX_RETRIES, backoff = INITIAL_BACKOFF_MS) {
  try {
    return await fn();
  } catch (err) {
    const status = err.response?.status;
    const retriable = status === 429 || (status >= 500 && status <= 599);
    if (retriable && retries > 0) {
      console.warn(`[Ideon] HTTP ${status}. Retrying in ${backoff}ms...`);
      await new Promise((r) => setTimeout(r, backoff));
      return requestWithRetry(fn, retries - 1, Math.min(backoff * 2, 8000));
    }
    console.error("[Ideon] request failed:", {
      status,
      data: err.response?.data,
      message: err.message,
    });
    throw err;
  }
}

// --- Low-level HTTP helpers with throttle+retry ---
async function POST(path, data) {
  await throttle();
  console.log(`[Ideon] POST ${path}`);
  return requestWithRetry(() => api.post(path, data));
}

async function GET(path, params) {
  await throttle();
  console.log(`[Ideon] GET ${path}`);
  return requestWithRetry(() => api.get(path, { params }));
}

// --- Public API ---
// 1) Create Group
async function createGroup(groupData) {
  return POST("/groups", groupData);
}

// 2) Add Member
async function addMember(groupId, memberData) {
  if (!groupId) throw new Error("addMember requires groupId");
  return POST(`/groups/${encodeURIComponent(groupId)}/members`, memberData);
}

// 3) ICHRA affordability (NESTED under /groups/{id})
async function startICHRA(groupId, payload) {
  if (!groupId) throw new Error("startICHRA requires groupId");
  // payload:
  // { ichra_affordability_calculation: { effective_date, plan_year?, rating_area_location } }
  return POST(`/groups/${encodeURIComponent(groupId)}/ichra_affordability_calculations`, payload);
}

// 4) Poll ICHRA calc status
async function getICHRA(calcId) {
  if (!calcId) throw new Error("getICHRA requires calcId");
  return GET(`/ichra_affordability_calculations/${encodeURIComponent(calcId)}`);
}

// 5) Fetch member-level ICHRA details
async function getICHRAForMembers(calcId) {
  if (!calcId) throw new Error("getICHRAForMembers requires calcId");
  return GET(`/ichra_affordability_calculations/${encodeURIComponent(calcId)}/members`);
}

module.exports = {
  createGroup,
  addMember,
  startICHRA,
  getICHRA,
  getICHRAForMembers,
  POST,
  GET,
};
