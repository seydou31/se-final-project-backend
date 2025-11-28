// Migration script to add state information to existing events
// Run with: node utils/addStateToEvents.js

const mongoose = require('mongoose');
const Event = require('../models/event');
const config = require('./config');

// Helper function to get state from coordinates using Google Geocoding API
const getStateFromCoordinates = async (lat, lng, apiKey) => {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.results && data.results[0]) {
      const addressComponents = data.results[0].address_components;
      const stateComponent = addressComponents.find(
        component => component.types.includes('administrative_area_level_1')
      );
      return stateComponent ? stateComponent.long_name : null;
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
};

// Add delay to avoid rate limiting
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const migrateEvents = async () => {
  try {
    console.log('Starting migration...');
    await mongoose.connect(config.MONGODB_URI);
    console.log('Connected to MongoDB');

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
      console.error('GOOGLE_PLACES_API_KEY not found in environment variables');
      process.exit(1);
    }

    // Find events without state field
    const events = await Event.find({ state: { $exists: false } });

    console.log(`Found ${events.length} events without state information`);

    if (events.length === 0) {
      console.log('No events to migrate');
      process.exit(0);
    }

    let updatedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < events.length; i++) {
      const currentEvent = events[i];
      console.log(`\nProcessing event ${i + 1}/${events.length}: ${currentEvent.title}`);
      console.log(`Location: ${currentEvent.location.lat}, ${currentEvent.location.lng}`);

      const state = await getStateFromCoordinates(
        currentEvent.location.lat,
        currentEvent.location.lng,
        apiKey
      );

      if (state) {
        await Event.findByIdAndUpdate(currentEvent._id, { state });
        console.log(`✓ Updated event with state: ${state}`);
        updatedCount++;
      } else {
        console.log(`✗ Failed to get state for event: ${currentEvent.title}`);
        failedCount++;
      }

      // Add a small delay to avoid hitting API rate limits
      if (i < events.length - 1) {
        await delay(200); // 200ms delay between requests
      }
    }

    console.log('\n=== Migration Complete ===');
    console.log(`Total events processed: ${events.length}`);
    console.log(`Successfully updated: ${updatedCount}`);
    console.log(`Failed: ${failedCount}`);

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

// Run the migration
migrateEvents();
