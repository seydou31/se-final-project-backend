const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcryptjs");

const user = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: (v) => validator.isEmail(v),
      message: "Wrong email format",
    },
  },
  password: {
    type: String,
    required() {
      // Password is only required if googleId is not present
      return !this.googleId;
    },
    select: false,
    minlength: 8,
    validate: {
      validator(password) {
        // Skip validation if password is not provided (Google OAuth user)
        if (!password) return true;
        const passwordRegex =
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
        return passwordRegex.test(password);
      },
      message:
        "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
    },
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true, // Allows multiple null values
  },
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
  tokenVersion: {
    type: Number,
    default: 0,
  },
});

user.statics.findUserByCredentials = function findUserByCredentials(email, password) {
  return this.findOne({ email })
    .select("+password")
    .then((foundUser) => {
      if (!foundUser) {
        return Promise.reject(new Error("Incorrect password or email"));
      }

      // Check if user signed up with Google
      if (foundUser.googleId && !foundUser.password) {
        return Promise.reject(new Error("Please sign in with Google"));
      }

      return bcrypt.compare(password, foundUser.password).then((matched) => {
        if (!matched) {
          return Promise.reject(new Error("Incorrect password or email"));
        }

        return foundUser;
      });
    });
};

module.exports = mongoose.model("user", user);
