// server/routes/auth.js
const express = require("express");
const ctl = require("../controllers/authController");
const requireAuth = require("../middleware/Auth");

const router = express.Router();

/* ---------------- Public ---------------- */

// Login
router.post("/login", ctl.login);

// ✅ Pre-signup (no DB row yet)
router.post("/pre-signup/request-code", ctl.preSignupRequestCode); // send 6-digit code (in-memory)
router.post("/pre-signup/verify", ctl.preSignupVerify);           // verify code -> CREATE USER + JWT

// (Optional) legacy/DB-first signup flow — keep only if you still use it anywhere
// router.post("/signup", ctl.signup);
// router.post("/verify-signup", ctl.verifySignup);
// router.post("/resend-signup-code", ctl.resendSignupCode);

// Link-based reset (legacy)
router.post("/forgot", ctl.forgot);
router.post("/reset", ctl.reset);

// Code-based reset
router.post("/request-code", ctl.requestCode);
router.post("/verify-code", ctl.verifyCode);
router.post("/reset-with-code", ctl.resetWithCode);

/* ---------------- Authed ---------------- */
router.get("/me", requireAuth, ctl.me);

module.exports = router;