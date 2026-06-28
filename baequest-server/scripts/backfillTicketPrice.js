// One-time backfill: events created before per-event ticketPrice was wired up
// collected paid check-ins under the old global TICKET_PRICE env var, but their
// ticketPrice field was never set (defaults to 0). This sets ticketPrice on those
// events to the historical global price so earnings reflect what was actually charged.
//
// Usage: node scripts/backfillTicketPrice.js [--dry-run]

require("dotenv").config();
const mongoose = require("mongoose");
const CuratedEvent = require("../models/curatedEvent");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/baequest-db";
const HISTORICAL_TICKET_PRICE_CENTS = parseInt(process.env.TICKET_PRICE || "0", 10);
const dryRun = process.argv.includes("--dry-run");

async function run() {
  if (HISTORICAL_TICKET_PRICE_CENTS <= 0) {
    console.error("TICKET_PRICE env var is not set to a positive value — nothing to backfill.");
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI, { dbName: "baequest" });

  const affected = await CuratedEvent.find({
    ticketPrice: { $in: [0, null] },
    paidCheckinCount: { $gt: 0 },
  }).select("_id name paidCheckinCount");

  console.log(`Found ${affected.length} event(s) with paid check-ins but ticketPrice=0:`);
  affected.forEach((e) => console.log(`  ${e._id} "${e.name}" — paidCheckinCount=${e.paidCheckinCount}`));

  if (dryRun) {
    console.log(`\nDry run — would set ticketPrice=${HISTORICAL_TICKET_PRICE_CENTS} (cents) on ${affected.length} event(s). No changes made.`);
  } else if (affected.length > 0) {
    const result = await CuratedEvent.updateMany(
      { _id: { $in: affected.map((e) => e._id) } },
      { $set: { ticketPrice: HISTORICAL_TICKET_PRICE_CENTS } }
    );
    console.log(`\nUpdated ${result.modifiedCount} event(s) to ticketPrice=${HISTORICAL_TICKET_PRICE_CENTS} (cents).`);
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
