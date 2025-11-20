const event = require("../models/event");

module.exports.seedEvents = async () => {
  const count = await event.countDocuments();
  if (count === 0) {
    const now = new Date();

    // Create events for today and tomorrow
    const today = new Date(now);
    today.setHours(14, 0, 0, 0); // 2 PM today

    const todayEnd = new Date(today);
    todayEnd.setHours(17, 0, 0, 0); // 5 PM today

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(16, 0, 0, 0); // 4 PM tomorrow

    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(18, 0, 0, 0); // 6 PM tomorrow

    const events = [
      {
        title: "Coffee & Chill ☕",
        date: today,
        endTime: todayEnd,
        description: "Sip coffee and talk to cool people",
        image:
          "https://coffeesmiley.com/wp-content/uploads/2022/12/EE_hipster-looking-coffee-shop-ready-to-open-2021-08-29-00-02-27-utc.webp",
        location: { name: "Blue Bottle Coffee", lat: 38.98795531204506, lng: -76.97771125336808 },
      },
      {
        title: "Weekend Hiking Meetup 🥾",
        date: tomorrow,
        endTime: tomorrowEnd,
        description: "Explore the outdoor with cool people",
        image:
          "https://th.bing.com/th/id/R.6627ad68edf06512361d163d6ac6681f?rik=kofzoMuo7mTSSA&riu=http%3a%2f%2fwww.nps.gov%2fmora%2fplanyourvisit%2fimages%2fKevin_Bacher_139.JPG&ehk=6XHLcpRTq64PooftL%2fsbh73K5bHJkBCBnlaz9NzzJFU%3d&risl=1&pid=ImgRaw&r=0",
        location: { name: "Muir Woods Trail", lat: 38.897957, lng: -77.036560 },
      },
    ];
    await event.insertMany(events);
    console.log("✅ Events seeded with current dates!");
  }
};
