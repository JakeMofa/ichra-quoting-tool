// server/models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },

    passwordHash: { type: String, required: true },

    // password reset (link-based, legacy)
    resetToken: { type: String, default: null },
    resetTokenExpiresAt: { type: Date, default: null },

    // password reset (code-based, preferred)
    resetCode: { type: String, default: null },
    resetCodeExpiresAt: { type: Date, default: null },

    // profile info
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },

    // signup email verification
    emailVerified: { type: Boolean, default: false },   //  user must verify before full access
    verifyCode: { type: String, default: null },        //  code sent on signup
    verifyCodeExpiresAt: { type: Date, default: null }, //  expiry (e.g. 10 min)
  },
  { timestamps: true }
);

// Helper to set a password
UserSchema.methods.setPassword = async function setPassword(plain) {
  const salt = await bcrypt.genSalt(12);
  this.passwordHash = await bcrypt.hash(plain, salt);
};

// Helper to validate a password
UserSchema.methods.validatePassword = async function validatePassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

module.exports = mongoose.model("User", UserSchema);