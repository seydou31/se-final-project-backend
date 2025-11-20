// models/Event.js
const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,

  location: {
    name: String,
    lat: Number,
    lng: Number,
  },
  date: { type: Date, required: true },
   endTime: { type: Date, required: true },
  category: String, // optional: "coffee", "music", etc.
  image: String, // optional thumbnail or banner
  googlePlaceId: String, // optional: Google Places ID for reference
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("event", eventSchema);
