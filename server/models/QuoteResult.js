// server/models/QuoteResult.js
const mongoose = require("mongoose");

// One plan quote line
const planQuoteSchema = new mongoose.Schema(
  {
    plan_id: { type: String, required: true },
    premium: { type: Number, required: true },
    adjusted_cost: { type: Number, required: true },
    benchmark_plan_id: { type: String, default: null },
    benchmark_premium: { type: Number, default: null },
    plan_details: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

// One member’s quote bundle
const memberQuoteSchema = new mongoose.Schema(
  {
    member: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },

    //  optional so skipped members can be saved
    affordability: { type: mongoose.Schema.Types.Mixed, default: null, required: false },

    // room for skip reasons, computed inputs (zip, county, age, tobacco), etc.
    meta: { type: mongoose.Schema.Types.Mixed, default: null },

    quotes: { type: [planQuoteSchema], default: [] },
  },
  { _id: false }
);

const quoteResultSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    quotes: { type: [memberQuoteSchema], default: [] },
    raw_context: { type: mongoose.Schema.Types.Mixed, default: null }, // e.g., { memberCount, savedCount }
  },
  { timestamps: true }
);

// Handy for “latest quotes” query
quoteResultSchema.index({ group: 1, createdAt: -1 });

module.exports = mongoose.model("QuoteResult", quoteResultSchema);