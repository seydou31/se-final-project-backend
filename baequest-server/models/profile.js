const mongoose = require("mongoose");
const validator = require("validator");
const possibleInterests = require('../constants/interests')
const profile = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    minlength: 2,
    maxlength: 30,
  },
  age: {
    type: Number,
    required: true,
    minlength: 18,
    maxlength: 99,
  },

  gender: {
    type: String,
    enum: ["male", "female"],
    required: true,
  },
  bio: {
    type: String,
    minlength: 6,
    maxlength: 280,
    required: true,
  },
  interests: {
    type: Array,
    default: [],

    validate: {
      validator: function (arr) {
        const max3 = arr.length > 0 && arr.length <= 3;

        const isInPossibleInterests = arr.every((word) =>
          possibleInterests.includes(word)
        );

        return max3 && isInPossibleInterests;
      },
      message: "You must select between 1 and 3 interests.",
    },
    required: true,
  },
  convoStarter: {
    type: String,
    minlength: 6,
    maxlength: 160,
    required: true,
  },
   location: {
    lat: Number,
    lng: Number,
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "event" },
    updatedAt: Date,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("profile", profile);
