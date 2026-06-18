const profile = require("../models/profile");
const CuratedEvent = require("../models/curatedEvent");
const { NotFoundError } = require("../utils/errors");

async function completeEventCheckin({
  userId,
  event,
  lat,
  lng,
  io,
}) {
  const [
    existingPresence,
    currentUserProfile,
  ] = await Promise.all([
    profile
      .findOne({
        owner: userId,
        "location.eventId": {
          $exists: true,
          $ne: null,
        },
      })
      .select("location.eventId")
      .lean(),

    profile
      .findOneAndUpdate(
        { owner: userId },
        {
          location: {
            eventId: event._id,
            lat: Number(lat),
            lng: Number(lng),
            updatedAt: new Date(),
          },
        },
        {
          new: true,
        }
      )
      .select(
        "name age gender profession bio interests convoStarter profilePicture sexualOrientation owner"
      )
      .lean(),
  ]);

  if (!currentUserProfile) {
    throw new NotFoundError(
      "Profile not found"
    );
  }
  console.log("completeEventCheckin CALLED");
  // ============================================
  // SOCKET EVENTS
  // ============================================

  if (
    existingPresence?.location?.eventId &&
    String(existingPresence.location.eventId) !==
      String(event._id)
  ) {
    io.to(
      `event_${existingPresence.location.eventId}`
    ).emit(
      "user-checked-out",
      {
        userId,
        eventId:
          existingPresence.location.eventId,
      }
    );
  }

  io.to(`event_${event._id}`).emit(
    "user-checked-in",
    {
      user: currentUserProfile,
      eventId: event._id,
    }
  );

  // ============================================
  // MATCHING LOGIC
  // ============================================

  const {
    gender: userGender,
    sexualOrientation,
  } = currentUserProfile;

  const genderFilter = {};

  if (
    sexualOrientation === "straight"
  ) {
    genderFilter.gender =
      userGender === "male"
        ? "female"
        : "male";
  } else if (
    sexualOrientation === "gay"
  ) {
    genderFilter.gender =
      userGender;
  }

  const users = await profile
    .find({
      "location.eventId": event._id,
      owner: { $ne: userId },
      ...genderFilter,
    })
    .select(
      "name age gender profession bio interests convoStarter profilePicture sexualOrientation owner"
    )
    .lean();

  const compatibleUsers =
    users.filter((u) => {
      if (
        sexualOrientation ===
        "bisexual"
      ) {
        return true;
      }

      if (
        u.sexualOrientation ===
        "bisexual"
      ) {
        return true;
      }

      if (
        u.sexualOrientation ===
        "straight"
      ) {
        return (
          u.gender !== userGender
        );
      }

      if (
        u.sexualOrientation ===
        "gay"
      ) {
        return (
          u.gender === userGender
        );
      }

      return false;
    });

  return {
    currentUserProfile,
    compatibleUsers,
  };
}

module.exports = {
  completeEventCheckin,
};