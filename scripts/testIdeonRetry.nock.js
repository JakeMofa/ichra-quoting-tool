// server/scripts/testIdeonRetry.nock.js
require("dotenv").config({ path: "../.env" });
const nock = require("nock");

// Force logs + small backoff so test is fast
process.env.IDEON_LOG = "true";
process.env.IDEON_RETRY_MAX = "5";
process.env.IDEON_RETRY_BASE_DELAY_MS = "200";

const { GET } = require("../server/services/ideon");
const base = process.env.IDEON_BASE_URL || "https://api.ideonapi.com";

// Simulate 2x 429 then 200 OK
nock(base)
  .get("/_retrytest")
  .reply(429, { error: "rate limited" }, { "Retry-After": "0.4" }) // 400ms
  .get("/_retrytest")
  .reply(429, { error: "rate limited" }, { "Retry-After": "0.4" })
  .get("/_retrytest")
  .reply(200, { ok: true });

(async () => {
  const t0 = Date.now();
  function stamp(msg) {
    const ms = Date.now() - t0;
    console.log(`${ms}ms  ${msg}`);
  }

  stamp("Calling GET /_retrytest (will 429 twice then succeed)...");
  const res = await GET("/_retrytest");
  stamp(`Final status: ${res.status} (expected 200 after retries)`);
})();