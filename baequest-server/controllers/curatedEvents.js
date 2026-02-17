const CuratedEvent = require("../models/curatedEvent");
const { BadRequestError } = require("../utils/customErrors");

// Geocode an address using Google Geocoding API
const geocodeAddress = async (address) => {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new BadRequestError("Geocoding not configured");
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== "OK" || !data.results || data.results.length === 0) {
    throw new BadRequestError("Could not geocode address. Please check the address and try again.");
  }

  const location = data.results[0].geometry.location;
  return { lat: location.lat, lng: location.lng };
};

// Create a new curated event (public - no auth required)
module.exports.createEvent = async (req, res, next) => {
  const { name, address, lat, lng, startTime, endTime } = req.body;

  try {
    // Validate required fields
    if (!name || !address || !startTime || !endTime) {
      throw new BadRequestError("Name, address, start time, and end time are required");
    }

    // If lat/lng not provided, geocode the address
    let coordinates = { lat, lng };
    if (!lat || !lng) {
      coordinates = await geocodeAddress(address);
    }

    // Validate times
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestError("Invalid date format");
    }

    if (end <= start) {
      throw new BadRequestError("End time must be after start time");
    }

    const event = await CuratedEvent.create({
      name,
      address,
      location: {
        type: "Point",
        coordinates: [coordinates.lng, coordinates.lat], // GeoJSON uses [lng, lat]
      },
      startTime: start,
      endTime: end,
    });

    res.status(201).json({
      message: "Event created successfully",
      event,
    });
  } catch (err) {
    next(err);
  }
};

// Get nearby active curated events
module.exports.getNearbyEvents = async (req, res, next) => {
  const { lat, lng, radiusKm = 10 } = req.query;

  try {
    if (!lat || !lng) {
      throw new BadRequestError("Latitude and longitude are required");
    }

    const now = new Date();

    // Find events that are:
    // 1. Currently active (now is between startTime and endTime)
    // 2. Within the specified radius
    const events = await CuratedEvent.find({
      startTime: { $lte: now },
      endTime: { $gte: now },
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          $maxDistance: parseFloat(radiusKm) * 1000, // Convert km to meters
        },
      },
    });

    // Transform to match the format expected by frontend
    const formattedEvents = events.map((event) => ({
      placeId: `curated_${event._id}`,
      name: event.name,
      address: event.address,
      lat: event.location.coordinates[1],
      lng: event.location.coordinates[0],
      startTime: event.startTime,
      endTime: event.endTime,
      isCurated: true,
    }));

    res.json(formattedEvents);
  } catch (err) {
    next(err);
  }
};
