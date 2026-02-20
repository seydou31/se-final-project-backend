const mongoose = require("mongoose");
const event = require("../models/event");
const profile = require("../models/profile");
const logger = require("../utils/logger");
const {
  BadRequestError,
  NotFoundError,
} = require("../utils/customErrors");
const feedbackController = require('./eventFeedback');

module.exports.events = async (req, res, next) => {
  const now = new Date();
  const { state, city } = req.query;
  const userId = req.user._id; // Get current user's ID

  try {
    // Build query filter
    const filter = { endTime: { $gt: now } };

    // Add state filter if provided (case-insensitive, trimmed)
    if (state) {
      const trimmedState = state.trim();
      filter.state = { $regex: new RegExp(`^${trimmedState}$`, 'i') };
    }

    // Add city filter if provided (case-insensitive, trimmed)
    if (city) {
      const trimmedCity = city.trim();
      filter.city = { $regex: new RegExp(`^${trimmedCity}$`, 'i') };
    }

    const data = await event.find(filter);

    // Add goingCount and isUserGoing to each event
    const eventsWithCount = data.map(evt => {
      const eventObj = evt.toObject();
      const userIdString = userId.toString();
      const isUserGoing = eventObj.usersGoing && eventObj.usersGoing.some(id => id.toString() === userIdString);

      return {
        ...eventObj,
        goingCount: (eventObj.usersGoing && Array.isArray(eventObj.usersGoing)) ? eventObj.usersGoing.length : 0,
        isUserGoing // Add flag indicating if current user is going
      };
    });

    const filterDescription = [
      state ? `state: ${state}` : null,
      city ? `city: ${city}` : null
    ].filter(Boolean).join(', ');

    logger.info(`Found ${data.length} active events${filterDescription ? ` with filters (${filterDescription})` : ''}`);
    logger.info(`Sample event with count:`, eventsWithCount[0] ? { title: eventsWithCount[0].title, goingCount: eventsWithCount[0].goingCount, isUserGoing: eventsWithCount[0].isUserGoing } : 'No events');
    res.status(200).send(eventsWithCount);
  } catch (err) {
    next(err);
  }
};

module.exports.checkin = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { lat, lng, eventId } = req.body;

    if (lat == null || lng == null || !eventId) {
      throw new BadRequestError("Missing required fields");
    }

    const newEvent = await event.findById(eventId);
    if (!newEvent) {
      throw new NotFoundError("Event not found");
    }

    const latDiff = Math.abs(lat - newEvent.location.lat);
    const lngDiff = Math.abs(lng - newEvent.location.lng);
    const maxDiff = 0.03; // ~1.1 km or 0.7 miles

    if (latDiff > maxDiff || lngDiff > maxDiff) {
      return res.status(400).json({
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
    io.to(`event_${eventId}`).emit("user-checked-in", {
      user: newProfile,
      eventId,
    });

    return res.status(201).send(newProfile);
  } catch (err) {
    return next(err);
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

    // Send feedback request email (don't block checkout if it fails)
    try {
      await feedbackController.createFeedbackRequest(
        { user: req.user, body: { eventId } },
        { status: () => ({ json: () => {} }) }, // Mock res
        (err) => { if (err) logger.error('Failed to send feedback email:', err); }
      );
    } catch (feedbackErr) {
      logger.error('Error sending feedback request:', feedbackErr);
      // Don't fail checkout if feedback email fails
    }

    res.status(200).json({ message: "Checked out successfully", newProfile });
  } catch (err) {
    next(err);
  }
};

module.exports.markAsGoing = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { eventId } = req.body;

    logger.info(`📥 Received markAsGoing request - userId: ${userId}, eventId: ${eventId}`);

    if (!eventId) {
      throw new BadRequestError("Missing eventId");
    }

    const foundEvent = await event.findById(eventId);
    if (!foundEvent) {
      throw new NotFoundError("Event not found");
    }

    logger.info(`📍 Found event: ${foundEvent.title} (${foundEvent._id})`);
    logger.info(`Current usersGoing array:`, foundEvent.usersGoing);

    // Check if user already marked as going (use string comparison for safety)
    const userIdString = userId.toString();
    const alreadyGoing = foundEvent.usersGoing.some(id => id.toString() === userIdString);

    if (alreadyGoing) {
      logger.info(`User ${userId} already marked as going. Not adding duplicate.`);
      return res.status(200).json({
        message: "Already marked as going",
        count: foundEvent.usersGoing.length,
      });
    }

    // Add user to usersGoing array
    foundEvent.usersGoing.push(userId);
    await foundEvent.save();

    logger.info(`Updated usersGoing array:`, foundEvent.usersGoing);

    // Emit real-time update to all clients viewing this event
    const io = req.app.get("io");
    logger.info(`User ${userId} marked as going to event ${eventId}. Total going: ${foundEvent.usersGoing.length}`);

    // Convert ObjectId to string to ensure consistent comparison on frontend
    const eventIdString = foundEvent._id.toString();
    logger.info(`Broadcasting event-going-updated to all clients with eventId: ${eventIdString} (type: ${typeof eventIdString}), count: ${foundEvent.usersGoing.length}`);

    // Broadcast to ALL connected clients
    io.emit("event-going-updated", {
      eventId: eventIdString,
      count: foundEvent.usersGoing.length,
      userId: userId.toString(),
    });

    logger.info('✅ Socket.IO event emitted successfully');

    return res.status(200).json({
      message: "Marked as going",
      count: foundEvent.usersGoing.length,
    });
  } catch (err) {
    return next(err);
  }
};


module.exports.myEvents = async (req, res, next) => {
  const now = new Date();
  const userId = req.user._id;

  try {
    // Find events where the user is in the usersGoing array and event hasn't ended
    const data = await event.find({
      endTime: { $gt: now },
      usersGoing: userId
    });

    // Add goingCount to each event
    const eventsWithCount = data.map(evt => {
      const eventObj = evt.toObject();
      return {
        ...eventObj,
        goingCount: (eventObj.usersGoing && Array.isArray(eventObj.usersGoing)) ? eventObj.usersGoing.length : 0,
        isUserGoing: true // All events here have the user going
      };
    });

    logger.info(`Found ${data.length} events user is going to`);
    res.status(200).send(eventsWithCount);
  } catch (err) {
    next(err);
  }
};
