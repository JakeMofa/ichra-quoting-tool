//server/middleware/Auth.js
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const AUTH_HEADER = "authorization";

module.exports = function requireAuth(req, res, next) {
  const hdr = req.get(AUTH_HEADER);
  if (!hdr || !hdr.toLowerCase().startsWith("bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }
  const token = hdr.slice(7).trim();
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};