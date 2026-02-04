const mongoose = require("mongoose");
const event = require("../models/event");
require("dotenv").config();

// Extract city from address string
// Typical format: "123 Street Name, City, State ZIP"
function extractCityFromAddress(address) {
  if (!address) return null;

  // Split by comma and get the second-to-last part (usually the city)
  const parts = address.split(',').map(part => part.trim());

  if (parts.length >= 2) {
    // The city is typically before the state
    // e.g., "123 Main St, Los Angeles, CA 90001" -> parts[1] = "Los Angeles"
    return parts[parts.length - 2];
  }

  return null;
}

async function populateCityField() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/baequest";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    // Find all events without a city field (either doesn't exist, is null, or is empty)
    const events = await event.find({
      $or: [
        { city: { $exists: false } },
        { city: null },
        { city: "" }
      ]
    });
    console.log(`Found ${events.length} events without city field`);

    let updated = 0;
    let skipped = 0;

    for (const evt of events) {
      if (evt.location && evt.location.address) {
        const city = extractCityFromAddress(evt.location.address);

        if (city) {
          evt.city = city;
          await evt.save();
          console.log(`Updated event "${evt.title}" with city: ${city}`);
          updated++;
        } else {
          console.log(`Could not extract city from address for event: ${evt.title}`);
          skipped++;
        }
      } else {
        console.log(`No address found for event: ${evt.title}`);
        skipped++;
      }
    }

    console.log("\nMigration complete!");
    console.log(`Updated: ${updated} events`);
    console.log(`Skipped: ${skipped} events`);

    await mongoose.connection.close();
    console.log("Database connection closed");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

// Run the migration
populateCityField();
