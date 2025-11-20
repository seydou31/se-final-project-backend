const event = require("../models/event");
const profile = require("../models/profile");
const mongoose = require("mongoose");
const { fetchGooglePlaces } = require("../utils/fetchGooglePlaces");
const logger = require("../utils/logger");
const {
  BadRequestError,
  NotFoundError,
  InternalServerError,
} = require("../utils/customErrors");

module.exports.events = async (req, res, next) => {
  const now = new Date();

  try {
    const data = await event.find({ endTime: { $gt: now } }).orFail(() => {
      throw new NotFoundError("No event found");
    });
    logger.info(`Found ${data.length} active events`);
    res.status(200).send(data);
  } catch (err) {
    next(err);
  }
};

module.exports.checkin = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { lat, lng, eventId } = req.body;

    if (!lat || !lng || !eventId) {
      throw new BadRequestError("Missing required fields");
    }

    const newEvent = await event.findById(eventId);
    if (!newEvent) {
      throw new NotFoundError("Event not found");
    }

    const latDiff = Math.abs(lat - newEvent.location.lat);
    const lngDiff = Math.abs(lng - newEvent.location.lng);
    const maxDiff = 0.005;

    if (latDiff > maxDiff || lngDiff > maxDiff) {
      return res.status(200).json({
        newEvent,
        message: "User is too far away from the event, and must get directions.",
      });
    }

    const newProfile = await profile.findOneAndUpdate(
      { owner: userId },
      { location: { lat, lng, eventId, updatedAt: new Date() } },
      { new: true, upsert: true }
    );

    const io = req.app.get("io");
    logger.info(`Emitting user-checked-in for event: ${eventId}, user: ${newProfile._id}`);
    io.to(`event_${eventId}`).emit("user-checked-in", {
      user: newProfile,
      eventId,
    });

    res.status(201).send(newProfile);
  } catch (err) {
    next(err);
  }
};

module.exports.eventCheckout = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const userIdObj = new mongoose.Types.ObjectId(userId);
    const { eventId } = req.body;

    if (!eventId) {
      throw new BadRequestError("Missing eventId");
    }

    const newProfile = await profile.findOneAndUpdate(
      { owner: userIdObj },
      {
        $unset: { "location.eventId": "" },
        $set: { "location.updatedAt": new Date() },
      },
      { new: true }
    );

    const io = req.app.get("io");
    logger.info(`Emitting user-checked-out for event: ${eventId}, user: ${userId}`);
    io.to(`event_${eventId}`).emit("user-checked-out", {
      userId: newProfile._id,
      eventId,
    });

    res.status(200).json({ message: "Checked out successfully", newProfile });
  } catch (err) {
    next(err);
  }
};

module.exports.fetchAndCreateEvents = async (req, res, next) => {
  try {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
      throw new InternalServerError("Google API key not configured");
    }

    const { lat = 38.9072, lng = -77.0369, radius = 10000 } = req.body;
    const searchLocation = { lat, lng };

    const places = await fetchGooglePlaces(apiKey, searchLocation, radius);

    if (places.length === 0) {
      throw new NotFoundError("No places found");
    }

    const now = new Date();
    const eventsToCreate = places.map((place, index) => {
      const daysToAdd = Math.random() > 0.5 ? 0 : 1;
      const startHour = 10 + Math.floor(Math.random() * 10);

      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() + daysToAdd);
      startDate.setHours(startHour, 0, 0, 0);

      const endDate = new Date(startDate);
      endDate.setHours(startDate.getHours() + 2);

      return {
        ...place,
        date: startDate,
        endTime: endDate,
      };
    });

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
      }
    }

    logger.info(`Created ${savedEvents.length} new events from Google Places`);

    res.status(201).json({
      message: `Successfully created ${savedEvents.length} events`,
      events: savedEvents,
    });
  } catch (err) {
    next(err);
  }
};
