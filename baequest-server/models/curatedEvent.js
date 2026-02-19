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
  city: {
    type: String,
    trim: true,
  },
  state: {
    type: String,
    trim: true,
  },
  zipcode: {
    type: String,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000,
  },
  photo: {
    type: String, // URL
  },
  link: {
    type: String, // Event URL (e.g. Eventbrite, Facebook)
    trim: true,
  },
  startTime: {
    type: Date,
    required: true,
  },
  endTime: {
    type: Date,
    required: true,
  },
  usersGoing: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
  }],
  checkedInUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Geospatial index for finding nearby events
curatedEventSchema.index({ location: "2dsphere" });

// Index for finding active events
curatedEventSchema.index({ startTime: 1, endTime: 1 });

// Indexes for location-based filtering
curatedEventSchema.index({ state: 1, city: 1 });
curatedEventSchema.index({ zipcode: 1 });

module.exports = mongoose.model("CuratedEvent", curatedEventSchema);
