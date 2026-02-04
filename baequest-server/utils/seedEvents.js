const event = require("../models/event");
const logger = require("./logger");
const fs = require("fs");
const path = require("path");

// Helper functions for parsing DMV places
const dayMap = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 0,
};

function parseTime(timeStr) {
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return null;
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const period = match[3].toUpperCase();
  if (period === "PM" && hours !== 12) hours += 12;
  else if (period === "AM" && hours === 12) hours = 0;
  return { hours, minutes };
}

function parseOpeningHours(hoursStr) {
  const match = hoursStr.match(/^(\w+):\s*(.+)$/);
  if (!match) return null;
  const day = match[1];
  const timeRange = match[2];
  if (timeRange.toLowerCase() === "closed") return { day, closed: true };
  const times = timeRange.split("–").map((t) => t.trim());
  if (times.length !== 2) return null;
  const openTime = parseTime(times[0]);
  const closeTime = parseTime(times[1]);
  if (!openTime || !closeTime) return null;
  return {
    day,
    dayIndex: dayMap[day],
    openHours: openTime.hours,
    openMinutes: openTime.minutes,
    closeHours: closeTime.hours,
    closeMinutes: closeTime.minutes,
    closed: false,
  };
}

// Extract city from address string
// Typical format: "123 Street Name, City" or "123 Street Name, City, State ZIP"
function extractCityFromAddress(address) {
  if (!address) return null;

  // Split by comma and get the second part (usually the city)
  const parts = address.split(',').map(part => part.trim());

  if (parts.length >= 2) {
    // Return the second part which is typically the city
    // e.g., "1330 U St NW, Washington" -> "Washington"
    return parts[1];
  }

  return null;
}

async function seedDMVPlacesEvents() {
  try {
    // Read DMV places JSON file
    const placesPath = path.join(__dirname, "../../../place finder/dmv-places.json");
    if (!fs.existsSync(placesPath)) {
      logger.info("DMV places file not found, skipping DMV events seeding");
      return;
    }

    const places = JSON.parse(fs.readFileSync(placesPath, "utf8"));
    logger.info(`Loading ${places.length} places from DMV places file`);
    const now = new Date();
    const dmvEvents = [];

    places.forEach((place) => {
      if (!place.opening_hours || place.opening_hours.length === 0) return;

      // Skip parks
      if (place.types && place.types.some(type =>
        type.toLowerCase().includes('park') ||
        type.toLowerCase().includes('tourist_attraction')
      )) {
        return;
      }

      const schedule = {};
      place.opening_hours.forEach((hoursStr) => {
        const parsed = parseOpeningHours(hoursStr);
        if (parsed && parsed.dayIndex !== undefined) {
          schedule[parsed.dayIndex] = parsed;
        }
      });

      // Generate events for each day of the week that the place is open
      Object.keys(schedule).forEach((dayIndexStr) => {
        const dayIndex = parseInt(dayIndexStr);
        const daySchedule = schedule[dayIndex];

        if (!daySchedule || daySchedule.closed) return;

        // Find the next occurrence of this day of the week
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        const currentDayIndex = today.getDay();

        // Calculate days until this day of the week
        let daysUntil = dayIndex - currentDayIndex;
        if (daysUntil < 0) {
          daysUntil += 7; // Next week
        }

        const eventDate = new Date(today);
        eventDate.setDate(eventDate.getDate() + daysUntil);

        // Event starts at 6:00 PM
        const startTime = new Date(eventDate);
        startTime.setHours(18, 0, 0, 0);

        // Event ends at closing time
        const endTime = new Date(eventDate);
        endTime.setHours(daySchedule.closeHours, daySchedule.closeMinutes, 0, 0);

        // If closing time is before 6 AM (likely next day), add a day
        if (daySchedule.closeHours < 6) {
          endTime.setDate(endTime.getDate() + 1);
        }

        // Only create event if it ends after it starts
        if (endTime > startTime) {
          const priceStr = place.price_level ? "$".repeat(place.price_level) : "Free";
          const description =
            place.types && place.types.length > 0
              ? `Join us at ${place.name}! ${place.types.slice(0, 3).join(", ")}`
              : `Join us at ${place.name}!`;

          // Use photo if available, otherwise use a default placeholder
          const photo = place.photos && place.photos.length > 0
            ? place.photos[0].photo_url
            : "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800&q=80"; // Default event image

          // Extract city from address first
          const city = extractCityFromAddress(place.address);

          // Determine state based on city name
          let state = null;
          if (city) {
            const cityLower = city.toLowerCase();
            // Virginia cities
            if (cityLower.includes('arlington') || cityLower.includes('alexandria') ||
                cityLower.includes('falls church') || cityLower.includes('annandale') ||
                cityLower.includes('springfield') || cityLower.includes('mclean') ||
                cityLower.includes('vienna') || cityLower.includes('reston') ||
                cityLower.includes('herndon') || cityLower.includes('fairfax')) {
              state = 'Virginia';
            }
            // Maryland cities
            else if (cityLower.includes('bethesda') || cityLower.includes('silver spring') ||
                     cityLower.includes('rockville') || cityLower.includes('gaithersburg') ||
                     cityLower.includes('college park') || cityLower.includes('hyattsville') ||
                     cityLower.includes('greenbelt') || cityLower.includes('laurel') ||
                     cityLower.includes('bowie') || cityLower.includes('frederick')) {
              state = 'Maryland';
            }
            // Washington DC
            else if (cityLower.includes('washington')) {
              state = 'Washington DC';
            }
          }

          // Fallback to search_location if state not determined from city
          if (!state && place.search_location) {
            const locationLower = place.search_location.toLowerCase();
            if (locationLower.includes('washington') || locationLower.includes('dc')) {
              state = 'Washington DC';
            } else if (locationLower.includes('maryland') || locationLower.includes('md')) {
              state = 'Maryland';
            } else if (locationLower.includes('virginia') || locationLower.includes('va')) {
              state = 'Virginia';
            }
          }

          dmvEvents.push({
            title: place.name,
            date: startTime,
            endTime: endTime,
            description: description,
            image: photo,
            location: {
              name: place.name,
              address: place.address,
              lat: place.location.lat,
              lng: place.location.lng,
            },
            state: state,
            city: city,
            category: place.types && place.types.length > 0 ? place.types[0] : "social",
            url: place.website || place.google_maps_url,
            price: priceStr,
            usersGoing: [],
          });
        }
      });
    });

    logger.info(`Preparing to create ${dmvEvents.length} events`);

    // Create all DMV events
    const createdEvents = await Promise.all(
      dmvEvents.map(async (eventData) => {
        const existing = await event.findOne({
          "location.lat": eventData.location.lat,
          "location.lng": eventData.location.lng,
          date: eventData.date,
        });
        if (!existing) {
          await event.create(eventData);
          return true;
        }
        return false;
      })
    );

    const createdCount = createdEvents.filter((created) => created).length;
    if (createdCount > 0) {
      logger.info(`✅ Created ${createdCount} DMV place events!`);
    } else {
      logger.info(`No new events created (${dmvEvents.length} events already exist)`);
    }
  } catch (error) {
    logger.error("Error seeding DMV places events:", error);
  }
}


module.exports.seedEvents = async () => {
  // Delete ALL events to start fresh
  const deleteAllResult = await event.deleteMany({});
  logger.info(`🗑️ Deleted ALL ${deleteAllResult.deletedCount} events for fresh testing`);

  // Clean up expired events first
  const now = new Date();
  const deleteResult = await event.deleteMany({ endTime: { $lte: now } });
  if (deleteResult.deletedCount > 0) {
    logger.info(`Cleaned up ${deleteResult.deletedCount} expired events on startup`);
  }

  // Seed DMV places events
  await seedDMVPlacesEvents();

  // Create test event at user's current location
  const startTime = new Date();
  const endTime = new Date(startTime);
  endTime.setHours(endTime.getHours() + 3);

  const testEvent = {
    title: "Test Meetup in Arlington",
    date: startTime,
    endTime: endTime,
    description: "A test event to verify location-based features. Join us for a casual meetup in Arlington!",
    image: "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800&q=80",
    location: {
      name: "Test Location - Arlington",
      address: "1100 Wilson Blvd, Arlington",
      lat: 38.877116,
      lng: -77.01978,
    },
    state: "Virginia",
    city: "Arlington",
    category: "social",
    url: "https://baequests.com",
    price: "Free",
    usersGoing: [],
  };

  await event.create(testEvent);
  logger.info("✅ Test event created at current location");

  // Set up periodic cleanup (every 5 minutes)
  setInterval(async () => {
    try {
      const expiredDeleteResult = await event.deleteMany({ endTime: { $lte: new Date() } });
      if (expiredDeleteResult.deletedCount > 0) {
        logger.info(`Cleaned up ${expiredDeleteResult.deletedCount} expired events`);
      }
    } catch (err) {
      logger.error("Error during cleanup:", err);
    }
  }, 5 * 60 * 1000);

  logger.info("Event auto-cleanup scheduled (every 5 minutes)");
};
