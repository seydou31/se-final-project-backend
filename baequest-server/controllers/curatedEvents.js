const crypto = require("crypto");
const path = require("path");
const fs = require("fs").promises;
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const CuratedEvent = require("../models/curatedEvent");
const profile = require("../models/profile");
const user = require("../models/user");
const EventFeedback = require("../models/eventFeedback");
const { BadRequestError, NotFoundError } = require("../utils/customErrors");
const { sendFeedbackRequestEmail } = require("../utils/email");
const { sendCheckinNotification } = require("../utils/sms");
const { decryptPhone } = require("../utils/crypto");
const logger = require("../utils/logger");
const { isS3Configured } = require("../middleware/multer");

// Haversine distance in km between two lat/lng points
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Get coordinates from address using Google Places API (Find Place)
const getCoordinatesFromAddress = async (address) => {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new BadRequestError("Places API not configured");
  }

  // Use Find Place from Text to get location
  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(address)}&inputtype=textquery&fields=geometry&key=${apiKey}`;
  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== "OK" || !data.candidates || data.candidates.length === 0) {
    throw new BadRequestError("Could not find address. Please check the address and try again.");
  }

  const {location} = data.candidates[0].geometry;
  return { lat: location.lat, lng: location.lng };
};

// Upload a photo to S3 or local disk, returns the URL
async function uploadEventPhoto(file) {
  const ext = path.extname(file.originalname) || ".jpg";
  const uniqueName = `${crypto.randomBytes(16).toString("hex")}${ext}`;

  if (isS3Configured) {
    const s3 = new S3Client({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
    const key = `event-photos/${uniqueName}`;
    await s3.send(new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }));
    return `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com/${key}`;
  } 
    const uploadDir = path.join(__dirname, "..", "uploads", "event-photos");
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(path.join(uploadDir, uniqueName), file.buffer);
    return `/uploads/event-photos/${uniqueName}`;
  
}

// Create a new curated event (public - no auth required)
module.exports.createEvent = async (req, res, next) => {
  const { name, address, city, state, zipcode, lat, lng, startTime, endTime, description, link } = req.body;

  try {
    // Validate required fields
    if (!name || !address || !startTime || !endTime) {
      throw new BadRequestError("Name, address, start time, and end time are required");
    }

    // If lat/lng not provided, get coordinates from address
    let coordinates = { lat, lng };
    if (!lat || !lng) {
      coordinates = await getCoordinatesFromAddress(address);
    }

    // Validate times
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestError("Invalid date format");
    }

    if (end <= start) {
      throw new BadRequestError("End time must be after start time");
    }

    // Upload photo if provided
    let photoUrl;
    if (req.file) {
      photoUrl = await uploadEventPhoto(req.file);
    }

    const event = await CuratedEvent.create({
      name,
      address,
      ...(city && { city }),
      ...(state && { state }),
      ...(zipcode && { zipcode }),
      ...(description && { description }),
      ...(photoUrl && { photo: photoUrl }),
      ...(link && { link }),
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

// Get all upcoming/current events with optional filters and distance sort
module.exports.getEvents = async (req, res, next) => {
  try {
    const { lat, lng, state, city, zipcode, dateFrom, dateTo } = req.query;
    const userId = req.user._id;
    const now = new Date();

    const query = { endTime: { $gte: now } };

    if (state) query.state = new RegExp(`^${state}$`, 'i');
    if (city) query.city = new RegExp(`^${city}$`, 'i');
    if (zipcode) query.zipcode = zipcode;
    if (dateFrom) query.startTime = { ...query.startTime, $gte: new Date(dateFrom) };
    if (dateTo) query.startTime = { ...query.startTime, $lte: new Date(dateTo) };

    let events;
    const userLat = lat ? parseFloat(lat) : null;
    const userLng = lng ? parseFloat(lng) : null;

    if (userLat && userLng) {
      // Sort by distance using $near — must use a separate query then apply filters
      // Use $geoNear in aggregate for filtering + distance in one pass
      const pipeline = [
        {
          $geoNear: {
            near: { type: "Point", coordinates: [userLng, userLat] },
            distanceField: "distanceMeters",
            spherical: true,
            query,
          },
        },
      ];
      events = await CuratedEvent.aggregate(pipeline);
    } else {
      events = await CuratedEvent.find(query).sort({ startTime: 1 }).lean();
    }

    const result = events.map(event => {
      const eventLng = event.location.coordinates[0];
      const eventLat = event.location.coordinates[1];
      const distanceKm = (userLat && userLng)
        ? (event.distanceMeters / 1000)
        : null;

      return {
        _id: event._id,
        name: event.name,
        address: event.address,
        city: event.city,
        state: event.state,
        zipcode: event.zipcode,
        description: event.description,
        photo: event.photo,
        link: event.link,
        lat: eventLat,
        lng: eventLng,
        startTime: event.startTime,
        endTime: event.endTime,
        goingCount: event.usersGoing ? event.usersGoing.length : 0,
        checkedInCount: event.checkedInUsers ? event.checkedInUsers.length : 0,
        isUserGoing: event.usersGoing
          ? event.usersGoing.some(id => id.toString() === userId.toString())
          : false,
        distanceKm,
      };
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

// Toggle RSVP ("I'm going") for an event
module.exports.markAsGoing = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const event = await CuratedEvent.findById(id);
    if (!event) throw new NotFoundError("Event not found");

    const isGoing = event.usersGoing.some(uid => uid.toString() === userId.toString());

    if (isGoing) {
      event.usersGoing.pull(userId);
    } else {
      event.usersGoing.push(userId);
    }
    await event.save();

    res.status(200).json({ isGoing: !isGoing, goingCount: event.usersGoing.length });
  } catch (err) {
    next(err);
  }
};

// Check in at an event (validates user is within 1 mile)
module.exports.checkinAtEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const { lat, lng } = req.body;

    if (!lat || !lng) throw new BadRequestError("Location coordinates are required to check in");

    const event = await CuratedEvent.findById(id);
    if (!event) throw new NotFoundError("Event not found");

    const now = new Date();
    if (now > event.endTime) throw new BadRequestError("This event has already ended");

    // Validate user is within 1 mile (1.60934 km)
    const eventLat = event.location.coordinates[1];
    const eventLng = event.location.coordinates[0];
    const distanceKm = haversineKm(parseFloat(lat), parseFloat(lng), eventLat, eventLng);

    if (distanceKm > 1.60934) {
      const distanceMiles = (distanceKm * 0.621371).toFixed(1);
      throw new BadRequestError(`You must be within 1 mile of the event to check in. You are ${distanceMiles} miles away.`);
    }

    // Add user to checkedInUsers if not already there
    if (!event.checkedInUsers.some(uid => uid.toString() === userId.toString())) {
      event.checkedInUsers.push(userId);
      await event.save();
    }

    // Update profile location and capture the result (avoids a second DB fetch)
    const currentUserProfile = await profile.findOneAndUpdate(
      { owner: userId },
      { location: { eventId: event._id, lat: parseFloat(lat), lng: parseFloat(lng), updatedAt: new Date() } },
      { new: true }
    );

    if (!currentUserProfile) throw new NotFoundError("Profile not found");

    const { gender: userGender, sexualOrientation } = currentUserProfile;

    const genderFilter = {};
    if (sexualOrientation === 'straight') {
      genderFilter.gender = userGender === 'male' ? 'female' : 'male';
    } else if (sexualOrientation === 'gay') {
      genderFilter.gender = userGender;
    }

    // Emit socket event
    const io = req.app.get("io");
    io.to(`event_${id}`).emit("user-checked-in", { user: currentUserProfile, eventId: id });

    // Fire-and-forget SMS to compatible users already at this event
    (async () => {
      try {
        const targets = await profile.find({
          owner: { $in: event.checkedInUsers, $ne: userId },
          ...genderFilter,
        }).select('phoneNumber sexualOrientation gender');

        const compatible = targets.filter(u => {
          if (!u.phoneNumber) return false;
          return sexualOrientation === 'bisexual' || u.sexualOrientation === 'bisexual'
            || (u.sexualOrientation === 'straight' && u.gender !== userGender)
            || (u.sexualOrientation === 'gay' && u.gender === userGender);
        });

        await Promise.allSettled(
          compatible.map(u => {
            let phone = u.phoneNumber;
            try { phone = decryptPhone(phone); } catch (e) { /* leave as-is */ }
            return sendCheckinNotification(phone, currentUserProfile.name, event.name);
          })
        );
      } catch (err) {
        logger.error('Failed to send SMS check-in notifications:', err);
      }
    })();

    // Return compatible users at this event
    const allCheckedIn = await profile.find({
      owner: { $in: event.checkedInUsers, $ne: userId },
      ...genderFilter,
    }).select("name age gender profession bio interests convoStarter profilePicture sexualOrientation owner");

    const compatibleUsers = allCheckedIn.filter(u => {
      if (sexualOrientation === 'bisexual') return true;
      if (u.sexualOrientation === 'straight') return u.gender !== userGender;
      if (u.sexualOrientation === 'gay') return u.gender === userGender;
      if (u.sexualOrientation === 'bisexual') return true;
      return false;
    });

    logger.info(`User ${userId} checked in at event ${id}`);
    return res.status(200).json({ message: "Checked in successfully", users: compatibleUsers });
  } catch (err) {
    return next(err);
  }
};

// Check out from an event
module.exports.checkoutFromEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const event = await CuratedEvent.findById(id);
    if (!event) throw new NotFoundError("Event not found");

    // Remove user from checkedInUsers
    event.checkedInUsers.pull(userId);
    await event.save();

    // Clear profile location
    await profile.findOneAndUpdate(
      { owner: userId },
      { $unset: { "location.eventId": "", "location.lat": "", "location.lng": "" }, $set: { "location.updatedAt": new Date() } }
    );

    // Emit socket event
    const io = req.app.get("io");
    io.to(`event_${id}`).emit("user-checked-out", { userId, eventId: id });

    // Fire-and-forget feedback email
    (async () => {
      try {
        const existing = await EventFeedback.findOne({ userId, eventId: event._id });
        if (existing) return;

        const foundUser = await user.findById(userId);
        if (!foundUser?.email) return;

        const token = crypto.randomBytes(32).toString('hex');
        await EventFeedback.create({
          userId,
          eventId: event._id,
          placeName: event.name,
          placeAddress: event.address || '',
          token,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          emailSent: true,
          emailSentAt: new Date(),
        });

        const feedbackUrl = `${process.env.FRONTEND_URL || 'https://baequests.com'}/event-feedback?token=${token}`;
        await sendFeedbackRequestEmail(foundUser.email, feedbackUrl, {
          name: event.name,
          date: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
          location: event.address || 'N/A',
        });
      } catch (err) {
        logger.error('Failed to create event feedback request:', err);
      }
    })();

    logger.info(`User ${userId} checked out from event ${id}`);
    res.status(200).json({ message: "Checked out successfully" });
  } catch (err) {
    next(err);
  }
};

// Get compatible users checked in at an event
module.exports.getUsersAtEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const event = await CuratedEvent.findById(id);
    if (!event) throw new NotFoundError("Event not found");

    const currentUserProfile = await profile.findOne({ owner: userId });
    if (!currentUserProfile) return res.status(404).json({ error: "Profile not found" });

    const { gender: userGender, sexualOrientation } = currentUserProfile;

    const genderFilter = {};
    if (sexualOrientation === 'straight') {
      genderFilter.gender = userGender === 'male' ? 'female' : 'male';
    } else if (sexualOrientation === 'gay') {
      genderFilter.gender = userGender;
    }

    const allCheckedIn = await profile.find({
      owner: { $in: event.checkedInUsers, $ne: userId },
      ...genderFilter,
    }).select("name age gender profession bio interests convoStarter profilePicture sexualOrientation owner");

    const compatibleUsers = allCheckedIn.filter(u => {
      if (sexualOrientation === 'bisexual') return true;
      if (u.sexualOrientation === 'straight') return u.gender !== userGender;
      if (u.sexualOrientation === 'gay') return u.gender === userGender;
      if (u.sexualOrientation === 'bisexual') return true;
      return false;
    });

    return res.status(200).json(compatibleUsers);
  } catch (err) {
    return next(err);
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
