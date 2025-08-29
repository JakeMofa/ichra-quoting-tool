const mongoose = require("mongoose");

const quoteResultSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    quotes: [
      {
        member: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
        affordability: { type: Object, required: true }, // snapshot affordability result
        quotes: { type: Array, required: true },         // plan quotes
      }
    ],
    raw_context: { type: Object }, // optional metadata (e.g. memberCount)
  },
  { timestamps: true }
);

module.exports = mongoose.model("QuoteResult", quoteResultSchema);
