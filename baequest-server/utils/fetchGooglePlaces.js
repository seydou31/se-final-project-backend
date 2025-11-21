const axios = require("axios");

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

    const type = types[Math.floor(Math.random() * types.length)];

    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json`;
    const params = {
      location: `${location.lat},${location.lng}`,
      radius,
      type,
      key: apiKey,
    };

    const response = await axios.get(url, { params });

    if (response.data.status !== "OK") {
      console.error("Google Places API error:", response.data.status);
      return [];
    }

    // Transform Google Places results into our event format
    const places = response.data.results.slice(0, 10).map((place) => {
      return {
        title: place.name,
        description: place.vicinity || "Join us at this amazing spot!",
        location: {
          name: place.name,
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng,
        },
        category: place.types?.[0] || "social",
        image:
          place.photos && place.photos.length > 0
            ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${place.photos[0].photo_reference}&key=${apiKey}`
            : "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=400",
        googlePlaceId: place.place_id,
      };
    });

    console.log(`✅ Fetched ${places.length} places from Google API`);
    return places;
  } catch (error) {
    console.error("Error fetching Google Places:", error.message);
    return [];
  }
}

module.exports = { fetchGooglePlaces };
