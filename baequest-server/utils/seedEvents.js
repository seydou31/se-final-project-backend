const event = require("../models/event");
const { fetchGooglePlaces } = require("./fetchGooglePlaces");

module.exports.seedEvents = async () => {
  const now = new Date();

  // Check for active events (not expired)
  const activeCount = await event.countDocuments({ endTime: { $gt: now } });

  if (activeCount === 0) {
    console.log("No active events found, fetching from Google Places...");

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
      console.error("GOOGLE_PLACES_API_KEY not set, seeding with default events");
      await seedDefaultEvents();
      return;
    }

    // Default location (Washington DC area)
    const location = { lat: 38.9072, lng: -77.0369 };
    const places = await fetchGooglePlaces(apiKey, location, 10000);

    if (places.length === 0) {
      console.log("No places from Google API, seeding with default events");
      await seedDefaultEvents();
      return;
    }

    // Create events from Google Places
    const eventsToCreate = places.map((place) => {
      const daysToAdd = Math.random() > 0.5 ? 0 : 1;
      const startHour = 10 + Math.floor(Math.random() * 10);

      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() + daysToAdd);
      startDate.setHours(startHour, 0, 0, 0);

      const endDate = new Date(startDate);
      endDate.setHours(startDate.getHours() + 3);

      return {
        ...place,
        date: startDate,
        endTime: endDate,
      };
    });

    // Insert only unique events (by location)
    let createdCount = 0;
    for (const eventData of eventsToCreate) {
      const existing = await event.findOne({
        "location.lat": eventData.location.lat,
        "location.lng": eventData.location.lng,
      });

      if (!existing) {
        await event.create(eventData);
        createdCount++;
      }
    }

    console.log(`✅ Created ${createdCount} events from Google Places!`);
  } else {
    console.log(`✅ Found ${activeCount} active events, skipping seed`);
  }
};

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

  const events = [
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
  await event.insertMany(events);
  console.log("✅ Default events seeded!");
}
