const axios = require("axios");
const logger = require("./logger");

/**
 * Fetches fun places from Google Places API
 * @param {string} apiKey - Your Google Places API key
 * @param {object} location - { lat, lng } center point for search
 * @param {number} radius - Search radius in meters (default 5000)
 * @returns {Promise<Array>} Array of place objects
 */
async function fetchGooglePlaces(apiKey, location, radius = 5000) {
  try {
    const types = [
      "cafe",
      "restaurant",
      "bar",
      "park",
      "museum",
      "art_gallery",
      "bowling_alley",
      "movie_theater",
      "night_club",
    ];

    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json`;
    const seenPlaceIds = new Set();

    // Fetch places from multiple types in parallel
    const responses = await Promise.all(
      types.map(async (type) => {
        const params = {
          location: `${location.lat},${location.lng}`,
          radius,
          type,
          key: apiKey,
        };

        const response = await axios.get(url, { params });

        if (response.data.status === "OK") {
          return response.data.results.slice(0, 3).map((place) => ({
            type,
            place,
          }));
        }
        logger.error(`Google Places API error for type ${type}:`, response.data.status);
        return [];
      })
    );

    // Flatten and filter duplicates
    const allPlaces = responses
      .flat()
      .filter((item) => {
        if (seenPlaceIds.has(item.place.place_id)) {
          return false;
        }
        seenPlaceIds.add(item.place.place_id);
        return true;
      })
      .map(({ type, place }) => ({
        title: place.name,
        description: place.vicinity || "Join us at this amazing spot!",
        location: {
          name: place.name,
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng,
        },
        category: type,
        image:
          place.photos && place.photos.length > 0
            ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${place.photos[0].photo_reference}&key=${apiKey}`
            : "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=400",
        googlePlaceId: place.place_id,
      }));

    logger.info(`Fetched ${allPlaces.length} places from Google API`);
    return allPlaces;
  } catch (error) {
    logger.error("Error fetching Google Places:", error.message);
    return [];
  }
}

module.exports = { fetchGooglePlaces };
