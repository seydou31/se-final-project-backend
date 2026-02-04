const mongoose = require("mongoose");
const event = require("../models/event");
require("dotenv").config();

async function checkEvents() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/baequest";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    // Get all events
    const events = await event.find({}).limit(5);
    console.log(`\nFound ${events.length} events in database`);

    if (events.length > 0) {
      console.log("\nSample event structure:");
      events.forEach((evt, index) => {
        console.log(`\n--- Event ${index + 1} ---`);
        console.log(`Title: ${evt.title}`);
        console.log(`State: ${evt.state || 'NOT SET'}`);
        console.log(`City: ${evt.city || 'NOT SET'}`);
        console.log(`Address: ${evt.location?.address || 'NOT SET'}`);
        console.log(`Location name: ${evt.location?.name || 'NOT SET'}`);
      });
    } else {
      console.log("\nNo events found in database");
    }

    await mongoose.connection.close();
    console.log("\nDatabase connection closed");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkEvents();
