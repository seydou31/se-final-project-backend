require("dotenv").config();
const mongoose = require("mongoose");
const event = require("../models/event");
const { fetchGooglePlaces } = require("./fetchGooglePlaces");

async function loadGoogleEvents() {
  try {
    // Connect to MongoDB
    await mongoose.connect("mongodb://127.0.0.1:27017/baequest-db");
    console.log("✅ Connected to MongoDB");

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
      console.error("❌ Google API key not found in .env");
      process.exit(1);
    }

    // Fetch places from Google
    const searchLocation = { lat: 38.9072, lng: -77.0369 }; // Washington DC
    const radius = 10000; // 10km

    console.log("🔍 Fetching places from Google API...");
    const places = await fetchGooglePlaces(apiKey, searchLocation, radius);

    if (places.length === 0) {
      console.log("❌ No places found");
      process.exit(0);
    }

    console.log(`✅ Found ${places.length} places`);

    // Convert places to events with start/end times
    const now = new Date();
    const eventsToCreate = places.map((place, index) => {
      // Randomly assign events to today or tomorrow
      const daysToAdd = Math.random() > 0.5 ? 0 : 1;
      // Random start hour between 10 AM and 8 PM
      const startHour = 10 + Math.floor(Math.random() * 10);

      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() + daysToAdd);
      startDate.setHours(startHour, 0, 0, 0);

      const endDate = new Date(startDate);
      endDate.setHours(startDate.getHours() + 2); // 2-hour events

      return {
        ...place,
        date: startDate,
        endTime: endDate,
      };
    });

    // Save to database (avoid duplicates)
    console.log("💾 Saving events to database...");
    const savedEvents = [];
    for (const eventData of eventsToCreate) {
      const existing = await event.findOne({
        "location.lat": eventData.location.lat,
        "location.lng": eventData.location.lng,
        date: eventData.date,
      });

      if (!existing) {
        const newEvent = await event.create(eventData);
        savedEvents.push(newEvent);
        console.log(`  ✅ Created: ${newEvent.title}`);
      } else {
        console.log(`  ⏭️  Skipped duplicate: ${eventData.title}`);
      }
    }

    console.log(`\n🎉 Successfully created ${savedEvents.length} new events from Google Places`);

    // Show all events in database
    const allEvents = await event.find({ endTime: { $gt: now } });
    console.log(`\n📅 Total active events in database: ${allEvents.length}`);
    allEvents.forEach((e) => {
      console.log(`  - ${e.title} (${e.date.toLocaleString()})`);
    });

    await mongoose.disconnect();
    console.log("\n✅ Done!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

loadGoogleEvents();
