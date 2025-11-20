const mongoose = require("mongoose");
const event = require("../models/event");

async function clearEvents() {
  try {
    await mongoose.connect("mongodb://127.0.0.1:27017/baequest-db");
    console.log("Connected to MongoDB");

    const result = await event.deleteMany({});
    console.log(`✅ Deleted ${result.deletedCount} events`);

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

clearEvents();
