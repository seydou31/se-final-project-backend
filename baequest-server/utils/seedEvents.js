const event = require("../models/event");
const logger = require("./logger");

async function seedDefaultEvents() {
  const now = new Date();

  const today = new Date(now);
  today.setHours(14, 0, 0, 0);

  const todayEnd = new Date(today);
  todayEnd.setHours(17, 0, 0, 0);

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(16, 0, 0, 0);

  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setHours(18, 0, 0, 0);

  const defaultEvents = [
    {
      title: "Coffee & Chill",
      date: today,
      endTime: todayEnd,
      description: "Sip coffee and talk to cool people",
      image:
        "https://coffeesmiley.com/wp-content/uploads/2022/12/EE_hipster-looking-coffee-shop-ready-to-open-2021-08-29-00-02-27-utc.webp",
      location: { name: "Blue Bottle Coffee", lat: 38.98795531204506, lng: -76.97771125336808 },
    },
    {
      title: "Weekend Hiking Meetup",
      date: tomorrow,
      endTime: tomorrowEnd,
      description: "Explore the outdoor with cool people",
      image:
        "https://th.bing.com/th/id/R.6627ad68edf06512361d163d6ac6681f?rik=kofzoMuo7mTSSA&riu=http%3a%2f%2fwww.nps.gov%2fmora%2fplanyourvisit%2fimages%2fKevin_Bacher_139.JPG&ehk=6XHLcpRTq64PooftL%2fsbh73K5bHJkBCBnlaz9NzzJFU%3d&risl=1&pid=ImgRaw&r=0",
      location: { name: "Muir Woods Trail", lat: 38.897957, lng: -77.036560 },
    },
  ];

  const createdEvents = await Promise.all(
    defaultEvents.map(async (eventData) => {
      const existing = await event.findOne({
        "location.lat": eventData.location.lat,
        "location.lng": eventData.location.lng,
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
    logger.info(`Created ${createdCount} default events!`);
  }
}

module.exports.seedEvents = async () => {
  // Clean up expired events first
  const now = new Date();
  const deleteResult = await event.deleteMany({ endTime: { $lte: now } });
  if (deleteResult.deletedCount > 0) {
    logger.info(`Cleaned up ${deleteResult.deletedCount} expired events on startup`);
  }

  // Seed only default events (users will fetch Google Places via API)
  await seedDefaultEvents();

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
