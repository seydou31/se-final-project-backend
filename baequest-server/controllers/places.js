const crypto = require("crypto");
const profile = require("../models/profile");
const user = require("../models/user");
const EventFeedback = require("../models/eventFeedback");
const logger = require("../utils/logger");
const { BadRequestError } = require("../utils/customErrors");
const { sendFeedbackRequestEmail } = require("../utils/email");

// Proxy to Google Places API to hide API key from frontend
module.exports.getNearbyPlaces = async (req, res, next) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      throw new BadRequestError("Missing lat or lng");
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      logger.error("GOOGLE_PLACES_API_KEY not configured");
      return res.status(500).json({ error: "Places API not configured" });
    }

    // Search for nearby entertainment venues (lounges, clubs, bars, arcades, hotel lounges, amusement areas)
    // rankby=distance returns closest places first
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&rankby=distance&keyword=lounge|club|bar|arcade|amusement&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      logger.error(`Google Places API error: ${data.status}`, data.error_message);
      return res.status(500).json({ error: "Failed to fetch places" });
    }

    // Return top 4 places with relevant info
    const places = (data.results || []).slice(0, 4).map(place => ({
      placeId: place.place_id,
      name: place.name,
      address: place.vicinity,
      rating: place.rating,
      types: place.types,
      location: {
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng,
      },
      openNow: place.opening_hours?.open_now,
      photos: place.photos?.slice(0, 1).map(photo => ({
        reference: photo.photo_reference,
      })),
    }));

    // Get user counts for each place
    const placesWithCounts = await Promise.all(
      places.map(async (place) => {
        const count = await profile.countDocuments({
          "location.placeId": place.placeId,
        });
        return { ...place, userCount: count };
      })
    );

    logger.info(`Found ${placesWithCounts.length} nearby places for location ${lat}, ${lng}`);
    return res.status(200).json(placesWithCounts);
  } catch (err) {
    return next(err);
  }
};

// Get photo URL for a place
module.exports.getPlacePhoto = async (req, res, next) => {
  try {
    const { photoReference } = req.query;

    if (!photoReference) {
      throw new BadRequestError("Missing photoReference");
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Places API not configured" });
    }

    // Fetch the photo from Google and stream it to the client
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoReference}&key=${apiKey}`;
    const response = await fetch(photoUrl);

    if (!response.ok) {
      return res.status(response.status).json({ error: "Failed to fetch photo" });
    }

    // Set content type and CORS headers for cross-origin image loading
    res.set('Content-Type', response.headers.get('content-type'));
    res.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    res.set('Cross-Origin-Resource-Policy', 'cross-origin'); // Allow cross-origin access
    res.set('Access-Control-Allow-Origin', '*'); // Allow any origin for images

    const buffer = await response.arrayBuffer();
    return res.send(Buffer.from(buffer));
  } catch (err) {
    return next(err);
  }
};

// Get user count at a specific place
module.exports.getUserCountAtPlace = async (req, res, next) => {
  try {
    const { placeId } = req.params;

    if (!placeId) {
      throw new BadRequestError("Missing placeId");
    }

    const count = await profile.countDocuments({
      "location.placeId": placeId,
    });

    res.status(200).json({ placeId, count });
  } catch (err) {
    next(err);
  }
};

// Check in at a place
module.exports.checkinAtPlace = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { placeId, placeName, placeAddress } = req.body;

    if (!placeId) {
      throw new BadRequestError("Missing required field: placeId");
    }

    // Update user's profile with place info
    const updatedProfile = await profile.findOneAndUpdate(
      { owner: userId },
      {
        location: {
          placeId,
          placeName,
          placeAddress,
          updatedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!updatedProfile) {
      throw new BadRequestError("Profile not found");
    }

    // Emit socket event for real-time updates
    const io = req.app.get("io");
    io.to(`place_${placeId}`).emit("user-checked-in", {
      user: updatedProfile,
      placeId,
    });

    logger.info(`User ${userId} checked in at place ${placeId} (${placeName})`);
    res.status(201).json(updatedProfile);
  } catch (err) {
    next(err);
  }
};

// Check out from a place
module.exports.checkoutFromPlace = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { placeId } = req.body;

    if (!placeId) {
      throw new BadRequestError("Missing placeId");
    }

    // Get profile before clearing location so we have place details for feedback email
    const currentProfile = await profile.findOne({ owner: userId });
    const placeName = currentProfile?.location?.placeName;
    const placeAddress = currentProfile?.location?.placeAddress;

    const updatedProfile = await profile.findOneAndUpdate(
      { owner: userId },
      {
        $unset: {
          "location.placeId": "",
          "location.placeName": "",
          "location.placeAddress": "",
        },
        $set: { "location.updatedAt": new Date() },
      },
      { new: true }
    );

    // Emit socket event for real-time updates
    const io = req.app.get("io");
    io.to(`place_${placeId}`).emit("user-checked-out", {
      userId: updatedProfile._id,
      placeId,
    });

    // Create feedback request and send email asynchronously
    if (placeName) {
      (async () => {
        try {
          // Skip if feedback already exists for this user + place
          const existing = await EventFeedback.findOne({ userId, placeId });
          if (existing) return;

          const foundUser = await user.findById(userId);
          if (!foundUser?.email) return;

          // Generate feedback token
          const token = crypto.randomBytes(32).toString('hex');

          // Create feedback document
          await EventFeedback.create({
            userId,
            placeId,
            placeName,
            placeAddress: placeAddress || '',
            token,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            emailSent: true,
            emailSentAt: new Date(),
          });

          const feedbackUrl = `${process.env.FRONTEND_URL || 'https://baequests.com'}/event-feedback?token=${token}`;
          await sendFeedbackRequestEmail(foundUser.email, feedbackUrl, {
            name: placeName,
            date: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
            location: placeAddress || 'N/A',
          });
        } catch (err) {
          logger.error('Failed to create feedback request:', err);
        }
      })();
    }

    logger.info(`User ${userId} checked out from place ${placeId}`);
    res.status(200).json({ message: "Checked out successfully", profile: updatedProfile });
  } catch (err) {
    next(err);
  }
};

// Get users at a place (filtered by sexual orientation compatibility)
module.exports.getUsersAtPlace = async (req, res, next) => {
  try {
    const { placeId } = req.query;
    const userId = req.user._id;

    if (!placeId) {
      throw new BadRequestError("Missing placeId");
    }

    // Get current user's profile to determine their preferences
    const currentUserProfile = await profile.findOne({ owner: userId });

    if (!currentUserProfile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const { gender: userGender, sexualOrientation } = currentUserProfile;

    // Build gender filter based on sexual orientation
    const genderFilter = {};

    if (sexualOrientation === 'straight') {
      // Straight users see opposite gender
      genderFilter.gender = userGender === 'male' ? 'female' : 'male';
    } else if (sexualOrientation === 'gay') {
      // Gay users see same gender
      genderFilter.gender = userGender;
    }
    // Bisexual users don't have gender filter (see everyone)

    // Find all profiles checked in at this place, excluding current user
    const users = await profile.find({
      "location.placeId": placeId,
      owner: { $ne: userId },
      ...genderFilter
    }).select("name age gender profession bio interests location convoStarter profilePicture sexualOrientation");

    // Further filter to ensure mutual compatibility
    const filteredUsers = users.filter(u => {
      // If current user is bisexual, they can see everyone
      if (sexualOrientation === 'bisexual') {
        return true;
      }

      // Check if the other user would also want to see current user
      if (u.sexualOrientation === 'straight') {
        // Straight users want opposite gender
        return u.gender !== userGender;
      } if (u.sexualOrientation === 'gay') {
        // Gay users want same gender
        return u.gender === userGender;
      } if (u.sexualOrientation === 'bisexual') {
        // Bisexual users are compatible with everyone
        return true;
      }

      return false;
    });

    logger.info(`Found ${filteredUsers.length} compatible users at place ${placeId}`);
    return res.status(200).json(filteredUsers);
  } catch (err) {
    return next(err);
  }
};
