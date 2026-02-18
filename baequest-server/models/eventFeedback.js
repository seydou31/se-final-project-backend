const mongoose = require('mongoose');

const eventFeedbackSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'user',
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'event',
  },
  placeId: {
    type: String,
  },
  placeName: {
    type: String,
  },
  placeAddress: {
    type: String,
  },
  // Feedback token for email verification
  token: {
    type: String,
    required: true,
  },
  // Event feedback
  rating: {
    type: Number,
    min: 1,
    max: 5,
  },
  comment: {
    type: String,
    maxlength: 500,
    trim: true,
  },
  // Venue suggestion (optional)
  venueSuggestion: {
    name: {
      type: String,
      maxlength: 100,
      trim: true,
    },
    address: {
      type: String,
      maxlength: 200,
      trim: true,
    },
    city: {
      type: String,
      maxlength: 100,
      trim: true,
    },
    state: {
      type: String,
      maxlength: 50,
      trim: true,
    },
    type: {
      type: String,
      enum: ['restaurant', 'cafe', 'bar', 'park', 'museum', 'venue', 'other'],
    },
    reason: {
      type: String,
      maxlength: 300,
      trim: true,
    },
  },
  // Status tracking
  submitted: {
    type: Boolean,
    default: false,
  },
  submittedAt: {
    type: Date,
  },
  emailSent: {
    type: Boolean,
    default: false,
  },
  emailSentAt: {
    type: Date,
  },
  expiresAt: {
    type: Date,
    required: true,
    // Expires 7 days after event
  },
}, {
  timestamps: true,
});

// Indexes
eventFeedbackSchema.index(
  { userId: 1, eventId: 1 },
  { unique: true, partialFilterExpression: { eventId: { $type: 'objectId' } } }
); // One feedback request per user per event (only when eventId exists)
eventFeedbackSchema.index({ userId: 1, placeId: 1 }); // Lookup by user + place
eventFeedbackSchema.index({ token: 1 }); // Fast token lookup
eventFeedbackSchema.index({ eventId: 1 }); // Get all feedback for an event
eventFeedbackSchema.index({ rating: 1 }); // Filter by rating
eventFeedbackSchema.index({ submitted: 1 }); // Filter submitted vs pending
eventFeedbackSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-delete expired feedback requests

module.exports = mongoose.model('eventFeedback', eventFeedbackSchema);
