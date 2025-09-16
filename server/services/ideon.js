// server/services/ideon.js

// Notes:
// - BASE_URL: https://api.ideonapi.com   (no trailing /v6 in the URL)
// - ICHRA create is NESTED: POST /groups/{groupId}/ichra_affordability_calculations
// - addMember: POST /groups/{groupId}/members
// - Lightweight retry + throttle to respect ~100 rpm limit

require("dotenv").config();
const axios = require("axios");
const Bottleneck = require("bottleneck");

// --- Config (env fallbacks) ---
const ENV_IDEON_KEY =
  process.env.IDEON_API_KEY || process.env.VERICRED_API_KEY || "";
const IDEON_BASE_URL =
  process.env.IDEON_BASE_URL || "https://api.ideonapi.com";

// Throttle / rate limit
const MIN_DELAY_FALLBACK_MS = Number(process.env.IDEON_MIN_DELAY_MS || 700);

// Retry/backoff for 429/5xx
const MAX_RETRIES = Number(process.env.IDEON_RETRY_MAX || 3);
const INITIAL_BACKOFF_MS = Number(process.env.IDEON_RETRY_BASE_DELAY_MS || 500);

// Bottleneck config (respects ~100 rpm by default)
const limiter = new Bottleneck({
  reservoir: Number(process.env.IDEON_RATE_RESERVOIR || 100), // max tokens
  reservoirRefreshAmount: Number(process.env.IDEON_RATE_RESERVOIR || 100),
  reservoirRefreshInterval: Number(process.env.IDEON_RATE_INTERVAL_MS || 60000), // 1 minute
  minTime: Number(process.env.IDEON_RATE_MIN_TIME_MS || MIN_DELAY_FALLBACK_MS),
});

const IDEON_LOG =
  String(process.env.IDEON_LOG || "false").toLowerCase() === "true";

/**
 * Build an axios client for:
 * - per-request key (ctx.ideonKey) when provided, OR
 * - env key as fallback.
 */
function apiForCtx(ctx) {
  const key = (ctx && ctx.ideonKey) ? String(ctx.ideonKey) : ENV_IDEON_KEY;

  return axios.create({
    baseURL: IDEON_BASE_URL,
    headers: {
      // Ideon accepts any of these; we provide all for compatibility.
      "Vericred-Api-Key": key,
      "Ideon-Api-Key": key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Version": "v6", // pin version
    },
    timeout: 15000,
  });
}

// --- Retry wrapper ---
async function requestWithRetry(fn, retries = MAX_RETRIES, backoff = INITIAL_BACKOFF_MS) {
  try {
    return await fn();
  } catch (err) {
    const status = err.response?.status;
    const retriable = status === 429 || (status >= 500 && status <= 599);
    if (retriable && retries > 0) {
      const retryAfter = err.response?.headers?.["retry-after"];
      const waitMs = retryAfter ? Number(retryAfter) * 1000 : backoff;
      if (IDEON_LOG) {
        console.warn(`[Ideon] HTTP ${status}. Retrying in ${waitMs}ms...`);
      }
      await new Promise((r) => setTimeout(r, waitMs));
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

// --- Low-level HTTP helpers with Bottleneck + retry ---
// Now accept an optional ctx and build a client per call when provided.
async function POST(path, data, ctx) {
  const client = apiForCtx(ctx);
  return limiter.schedule(async () => {
    if (IDEON_LOG) console.log(`[Ideon] POST ${path}`);
    return requestWithRetry(() => client.post(path, data));
  });
}

async function GET(path, params, ctx) {
  const client = apiForCtx(ctx);
  return limiter.schedule(async () => {
    if (IDEON_LOG) console.log(`[Ideon] GET ${path}`);
    return requestWithRetry(() => client.get(path, { params }));
  });
}

// --- Public API (now accept optional ctx) ---
// 1) Create Group
async function createGroup(groupData, ctx) {
  return POST("/groups", groupData, ctx);
}

// 2) Add Member
async function addMember(groupId, memberData, ctx) {
  if (!groupId) throw new Error("addMember requires groupId");
  return POST(`/groups/${encodeURIComponent(groupId)}/members`, memberData, ctx);
}

// 3) ICHRA affordability (NESTED under /groups/{id})
async function startICHRA(groupId, payload, ctx) {
  if (!groupId) throw new Error("startICHRA requires groupId");
  return POST(
    `/groups/${encodeURIComponent(groupId)}/ichra_affordability_calculations`,
    payload,
    ctx
  );
}

// 4) Poll ICHRA calc status
async function getICHRA(calcId, ctx) {
  if (!calcId) throw new Error("getICHRA requires calcId");
  return GET(`/ichra_affordability_calculations/${encodeURIComponent(calcId)}`, undefined, ctx);
}

// 5) Fetch member-level ICHRA details
async function getICHRAForMembers(calcId, ctx) {
  if (!calcId) throw new Error("getICHRAForMembers requires calcId");
  return GET(
    `/ichra_affordability_calculations/${encodeURIComponent(calcId)}/members`,
    undefined,
    ctx
  );
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