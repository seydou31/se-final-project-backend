const mongoose = require("mongoose");

const curatedEventSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  address: {
    type: String,
    required: true,
    trim: true,
  },
  location: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },
    coordinates: {
      type: [Number], // [lng, lat] - GeoJSON format
      required: true,
    },
  },
  startTime: {
    type: Date,
    required: true,
  },
  endTime: {
    type: Date,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Geospatial index for finding nearby events
curatedEventSchema.index({ location: "2dsphere" });

// Index for finding active events
curatedEventSchema.index({ startTime: 1, endTime: 1 });

module.exports = mongoose.model("CuratedEvent", curatedEventSchema);
