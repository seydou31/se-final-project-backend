// models/Event.js
const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,

  location: {
    name: String,
    address: String, // Full address for map links
    lat: Number,
    lng: Number,
  },
  state: { type: String }, // US state code for filtering
  city: { type: String }, // City name for filtering
  date: { type: Date, required: true },
  endTime: { type: Date, required: true },
  category: String, // optional: "coffee", "music", etc.
  image: String, // optional thumbnail or banner
  url: String, // optional: external event website URL
  price: { type: String, default: "Free" }, // Price info: "Free", "$10", "$20-$50", etc.
  googlePlaceId: String, // optional: Google Places ID for reference
  usersGoing: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }], // Array of user IDs who marked as going
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("event", eventSchema);
