// server/controllers/authController.js
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const { sendResetEmail, sendResetCode } = require("../utils/mailer");

const JWT_SECRET  = process.env.JWT_SECRET  || "dev-secret";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "7d";
const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";

/* ---------------- helpers ---------------- */

function sign(user) {
  return jwt.sign(
    { sub: user._id.toString(), email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}
const genCode   = (len = 6) => String(Math.floor(Math.random() * 10 ** len)).padStart(len, "0");
const normEmail = (v = "") => String(v).toLowerCase().trim();
const normName  = (v = "") => String(v).trim().replace(/\s+/g, " ");

/* ------------- in-memory pre-signup store (email -> {code, expiresAt, attempts}) ------------- */
const preSignupStore = new Map();
function setPreSignup(email) {
  const entry = { code: genCode(6), expiresAt: Date.now() + 10 * 60 * 1000, attempts: 0 };
  preSignupStore.set(email, entry);
  return entry;
}

/* ---------------- Auth (login + me) ---------------- */

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

    const e = normEmail(email);
    const user = await User.findOne({ email: e });
    if (!user) return res.status(401).json({ error: "Invalid password" });

    const ok = await user.validatePassword(password);
    if (!ok) return res.status(401).json({ error: "Invalid password" });

    const token = sign(user);
    return res.json({
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ error: "Failed to log in" });
  }
};

exports.me = async (req, res) => {
  try {
    const u = await User.findById(req.user.id).lean();
    if (!u) return res.status(404).json({ error: "Not found" });
    return res.json({
      id: u._id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      createdAt: u.createdAt,
    });
  } catch {
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
};

/* ---------------- PRE-SIGNUP (no DB row yet) ---------------- */

/**
 * POST /api/auth/pre-signup/request-code
 * Body: { email }
 * Generates a code in memory and emails it. No DB write.
 */
exports.preSignupRequestCode = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: "Email is required" });
    const e = normEmail(email);

    // generate & store code in memory
    const { code } = setPreSignup(e);

    // email the code
    await sendResetCode({ to: e, code });
    console.log("🆕 Pre-signup code:", { email: e, code });

    return res.json({ ok: true, message: "Verification code sent." });
  } catch (err) {
    console.error("preSignupRequestCode error:", err);
    return res.status(500).json({ error: "Failed to send verification code" });
  }
};

/**
 * POST /api/auth/pre-signup/verify
 * Body: { email, code, firstName, lastName, password }
 * Verifies the in-memory code, then creates the user in DB and returns JWT.
 */
exports.preSignupVerify = async (req, res) => {
  try {
    let { email, code, firstName, lastName, password } = req.body || {};
    if (!email || !code || !firstName || !lastName || !password) {
      return res.status(400).json({ error: "Email, code, first name, last name, and password are required" });
    }

    email     = normEmail(email);
    code      = String(code).trim();
    firstName = normName(firstName);
    lastName  = normName(lastName);

    const entry = preSignupStore.get(email);
    if (!entry) return res.status(400).json({ error: "Invalid or expired code" });

    entry.attempts += 1;
    if (entry.attempts > 10) {
      preSignupStore.delete(email);
      return res.status(400).json({ error: "Invalid or expired code" });
    }

    const stillValid = entry.expiresAt > Date.now();
    if (!stillValid || entry.code !== code) {
      return res.status(400).json({ error: "Invalid or expired code" });
    }

    // if user already exists, just log them in
    const exists = await User.findOne({ email });
    if (exists) {
      preSignupStore.delete(email);
      const tokenExisting = sign(exists);
      return res.json({
        ok: true,
        user: {
          id: exists._id,
          email: exists.email,
          firstName: exists.firstName,
          lastName: exists.lastName,
          createdAt: exists.createdAt,
        },
        token: tokenExisting,
      });
    }

    // create the user now (ONLY after successful verification)
    const user = new User({
      email,
      firstName,
      lastName,
      passwordHash: "temp",
    });
    await user.setPassword(password);
    await user.save();

    preSignupStore.delete(email);

    const token = sign(user);
    return res.json({
      ok: true,
      message: "Email verified",
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (err) {
    console.error("preSignupVerify error:", err);
    return res.status(500).json({ error: "Failed to verify and create account" });
  }
};

/* ---------------- Password reset (link-based, kept for compat) ---------------- */

exports.forgot = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: "Email is required" });

    const e = normEmail(email);
    const user = await User.findOne({ email: e });
    if (!user) return res.json({ message: "If that email exists, a reset link has been sent." });

    const token = crypto.randomBytes(32).toString("hex");
    user.resetToken = token;
    user.resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const resetUrl = `${APP_BASE_URL}/reset-password?token=${encodeURIComponent(token)}`;
    await sendResetEmail(user.email, resetUrl);

    return res.json({ message: "If that email exists, a reset link has been sent." });
  } catch (err) {
    console.error("forgot error:", err);
    return res.status(500).json({ error: "Failed to start password reset" });
  }
};

exports.reset = async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) return res.status(400).json({ error: "Token and new password are required" });

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiresAt: { $gt: new Date() },
    });
    if (!user) return res.status(400).json({ error: "Invalid or expired token" });

    await user.setPassword(password);
    user.resetToken = null;
    user.resetTokenExpiresAt = null;
    await user.save();

    const jwtToken = sign(user);
    return res.json({
      message: "Password updated",
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      token: jwtToken,
    });
  } catch (err) {
    console.error("reset error:", err);
    return res.status(500).json({ error: "Failed to reset password" });
  }
};

/* ---------------- Password reset (code-based) ---------------- */

exports.requestCode = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: "Email is required" });

    const e = normEmail(email);
    const user = await User.findOne({ email: e });
    if (!user) return res.json({ ok: true, message: "If that email exists, a code has been sent." });

    user.resetCode = genCode(6);
    user.resetCodeExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendResetCode({ to: user.email, code: user.resetCode });
    console.log("🔐 Reset code issued:", { email: user.email, code: user.resetCode, expires: user.resetCodeExpiresAt });

    return res.json({ ok: true, message: "If that email exists, a code has been sent." });
  } catch (err) {
    console.error("requestCode error:", err);
    return res.status(500).json({ error: "Failed to send code" });
  }
};

exports.verifyCode = async (req, res) => {
  try {
    let { email, code } = req.body || {};
    if (!email || !code) return res.status(400).json({ error: "Email and code are required" });

    email = normEmail(email);
    code  = String(code).trim();

    const user = await User.findOne({ email });
    if (!user || !user.resetCode || !user.resetCodeExpiresAt) {
      return res.status(400).json({ error: "Invalid or expired code" });
    }

    const stillValid = user.resetCodeExpiresAt > new Date();
    const matches    = String(user.resetCode).trim() === code;
    if (!stillValid || !matches) return res.status(400).json({ error: "Invalid or expired code" });

    return res.json({ ok: true });
  } catch (err) {
    console.error("verifyCode error:", err);
    return res.status(500).json({ error: "Failed to verify code" });
  }
};

exports.resetWithCode = async (req, res) => {
  try {
    let { email, code, password } = req.body || {};
    if (!email || !code || !password) {
      return res.status(400).json({ error: "Email, code, and new password are required" });
    }

    email = normEmail(email);
    code  = String(code).trim();

    const user = await User.findOne({ email });
    if (!user || !user.resetCode || !user.resetCodeExpiresAt) {
      return res.status(400).json({ error: "Invalid or expired code" });
    }
    const stillValid = user.resetCodeExpiresAt > new Date();
    const matches    = String(user.resetCode).trim() === code;
    if (!stillValid || !matches) return res.status(400).json({ error: "Invalid or expired code" });

    await user.setPassword(password);
    user.resetCode = null;
    user.resetCodeExpiresAt = null;
    await user.save();

    const token = sign(user);
    return res.json({
      ok: true,
      message: "Password updated",
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      token,
    });
  } catch (err) {
    console.error("resetWithCode error:", err);
    return res.status(500).json({ error: "Failed to reset password with code" });
  }
};