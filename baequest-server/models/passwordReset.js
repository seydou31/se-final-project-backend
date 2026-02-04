const mongoose = require('mongoose');

const passwordResetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'user',
  },
  token: {
    type: String,
    required: true,
    unique: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    // Auto-delete documents after they expire
    expires: 0,
  },
  used: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Add index for faster lookups
passwordResetSchema.index({ token: 1, used: 1 });

module.exports = mongoose.model('passwordReset', passwordResetSchema);
