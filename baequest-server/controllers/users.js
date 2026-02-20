const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");
const user = require("../models/user");
const profile = require("../models/profile");
const EmailVerification = require("../models/emailVerification");
const SECRET = require("../utils/config");
const {
  UnauthorizedError, NotFoundError,
  ConflictError
} = require("../utils/customErrors");
const { sendVerificationEmail, sendWelcomeEmail } = require("../utils/email");
const logger = require("../utils/logger");

module.exports.createUser = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    const existing = await user.findOne({ email });
    if (existing) {
      throw new ConflictError("A user with this email already exists");
    }

    const hash = await bcrypt.hash(password, 10);
    const newUser = await user.create({ email, password: hash, isEmailVerified: false });

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(verificationToken)
      .digest('hex');

    // Create verification document with 24-hour expiration
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await EmailVerification.create({
      userId: newUser._id,
      token: hashedToken,
      expiresAt,
    });

    // Send verification and welcome emails asynchronously (don't block response)
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${verificationToken}`;
    sendVerificationEmail(email, verificationUrl).catch(err => {
      logger.error('Failed to send verification email:', err);
    });
    sendWelcomeEmail(email).catch(err => {
      logger.error('Failed to send welcome email:', err);
    });

    // Auto-login: generate JWT and set cookie
    const token = jwt.sign({ _id: newUser._id }, SECRET.JWT_SECRET, {
      expiresIn: "7d",
    });

    const userObject = newUser.toObject();
    delete userObject.password;
    return res
      .status(201)
      .cookie("jwt", token, {
        maxAge: 3600000 * 24 * 7,
        httpOnly: true,
        secure: true,
        sameSite: "None",
      })
      .json({
        ...userObject,
        message: 'Account created successfully. Please check your email to verify your account.'
      });
  } catch (err) {
    return next(err);
  }
};


module.exports.login = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    const foundUser = await user.findUserByCredentials(email, password);
    const token = jwt.sign({ _id: foundUser._id }, SECRET.JWT_SECRET, {
      expiresIn: "7d",
    });
    res
      .cookie("jwt", token, {
        maxAge: 3600000 * 24 * 7,
        httpOnly: true,
        secure: true,
        sameSite: "None",
      })
      .json({
        message: "Login successful",
        user: {
          _id: foundUser._id,
          email: foundUser.email,
        },
      });
  } catch (err) {
    next(new UnauthorizedError(err.message));
  }
};

module.exports.logout = (req, res) => {
  res.clearCookie("jwt", {
    httpOnly: true,
    secure: true,
    sameSite: "None",
  });

  return res.status(200).json({ message: "Logout successful" });
};

module.exports.refreshToken = async (req, res, next) => {
  const token = req.cookies.jwt;

  if (!token) {
    return next(new UnauthorizedError("No token provided"));
  }

  try {
    // Verify the current token
    const payload = jwt.verify(token, SECRET.JWT_SECRET);

    // Check if user still exists
    const foundUser = await user.findById(payload._id);
    if (!foundUser) {
      return next(new UnauthorizedError("User not found"));
    }

    // Generate new token with fresh expiration
    const newToken = jwt.sign({ _id: foundUser._id }, SECRET.JWT_SECRET, {
      expiresIn: "7d",
    });

    return res
      .cookie("jwt", newToken, {
        maxAge: 3600000 * 24 * 7,
        httpOnly: true,
        secure: true,
        sameSite: "None",
      })
      .json({
        message: "Token refreshed successfully",
        user: {
          _id: foundUser._id,
          email: foundUser.email,
        },
      });
  } catch (err) {
    // Token is invalid or expired
    return next(new UnauthorizedError("Invalid or expired token"));
  }
};

module.exports.getUsersAtEvent = async (req, res, next) => {
  const { eventId } = req.query;
  const userId = req.user._id;

  try {
    // Get current user's profile to determine their preferences
    const currentUserProfile = await profile.findOne({ owner: userId });

    if (!currentUserProfile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const { gender: userGender, sexualOrientation } = currentUserProfile;

    // Build gender filter based on sexual orientation
    const genderFilter = {};

    if (sexualOrientation === 'straight') {
      // Straight users see opposite gender
      genderFilter.gender = userGender === 'male' ? 'female' : 'male';
    } else if (sexualOrientation === 'gay') {
      // Gay users see same gender
      genderFilter.gender = userGender;
    }
    // Bisexual users don't have gender filter (see everyone)

    const users = await profile.find({
      "location.eventId": eventId,
      owner: { $ne: userId },
      ...genderFilter
    }).select("name age gender profession bio interests location convoStarter profilePicture sexualOrientation");

    // Further filter to ensure mutual compatibility
    const filteredUsers = users.filter(u => {
      // If current user is bisexual, they can see everyone
      if (sexualOrientation === 'bisexual') {
        return true;
      }

      // Check if the other user would also want to see current user
      if (u.sexualOrientation === 'straight') {
        // Straight users want opposite gender
        return u.gender !== userGender;
      } if (u.sexualOrientation === 'gay') {
        // Gay users want same gender
        return u.gender === userGender;
      } if (u.sexualOrientation === 'bisexual') {
        // Bisexual users are compatible with everyone
        return true;
      }

      return false;
    });

    return res.json(filteredUsers);
  } catch (err) {
    return next(err);
  }
};

module.exports.deleteUser = async(req, res, next ) => {
  const userId = req.user._id;
  try{
        await user.findByIdAndDelete(userId).orFail(() => {
      throw new NotFoundError("user not found")});
      res.status(200).json({ message: "User deleted successfully" });
  } catch(err) {
    next(err);
  }
}
module.exports.googleAuth = async (req, res, next) => {
  const { credential } = req.body;
  const {GOOGLE_CLIENT_ID} = process.env;

  try {
    // Verify the Google token
    const client = new OAuth2Client(GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const googleId = payload.sub;
    const {email} = payload;

    // Check if user exists
    let foundUser = await user.findOne({ $or: [{ googleId }, { email }] });

    let isNewUser = false;
    if (!foundUser) {
      // Create new user with Google ID - email is already verified by Google
      foundUser = await user.create({
        email,
        googleId,
        isEmailVerified: true,
      });
      isNewUser = true;
    } else if (!foundUser.googleId) {
      // User exists with email but no Google ID - link accounts and mark as verified
      foundUser.googleId = googleId;
      foundUser.isEmailVerified = true;
      await foundUser.save();
    }

    // Create JWT token
    const token = jwt.sign({ _id: foundUser._id }, SECRET.JWT_SECRET, {
      expiresIn: "7d",
    });

    // Send welcome email to new users
    if (isNewUser) {
      sendWelcomeEmail(email).catch(err => {
        logger.error('Failed to send welcome email:', err);
      });
    }

    res
      .cookie("jwt", token, {
        maxAge: 3600000 * 24 * 7,
        httpOnly: true,
        secure: true,
        sameSite: "None",
      })
      .json({
        message: "Google authentication successful",
        user: {
          _id: foundUser._id,
          email: foundUser.email,
        },
      });
  } catch (err) {
    next(new UnauthorizedError(`Google authentication failed: ${  err.message}`));
  }
};

// Google auth with access token (for mobile implicit flow)
module.exports.googleAuthWithToken = async (req, res, next) => {
  const { accessToken } = req.body;

  try {
    // Fetch user info from Google using access token
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user info from Google');
    }

    const payload = await response.json();
    const googleId = payload.id;
    const {email} = payload;

    if (!email) {
      throw new Error('Email not provided by Google');
    }

    // Check if user exists
    let foundUser = await user.findOne({ $or: [{ googleId }, { email }] });

    let isNewUser = false;
    if (!foundUser) {
      // Create new user with Google ID - email is already verified by Google
      foundUser = await user.create({
        email,
        googleId,
        isEmailVerified: true,
      });
      isNewUser = true;
    } else if (!foundUser.googleId) {
      // User exists with email but no Google ID - link accounts and mark as verified
      foundUser.googleId = googleId;
      foundUser.isEmailVerified = true;
      await foundUser.save();
    }

    // Create JWT token
    const token = jwt.sign({ _id: foundUser._id }, SECRET.JWT_SECRET, {
      expiresIn: "7d",
    });

    // Send welcome email to new users
    if (isNewUser) {
      sendWelcomeEmail(email).catch(err => {
        logger.error('Failed to send welcome email:', err);
      });
    }

    res
      .cookie("jwt", token, {
        maxAge: 3600000 * 24 * 7,
        httpOnly: true,
        secure: true,
        sameSite: "None",
      })
      .json({
        message: "Google authentication successful",
        user: {
          _id: foundUser._id,
          email: foundUser.email,
        },
      });
  } catch (err) {
    next(new UnauthorizedError(`Google authentication failed: ${  err.message}`));
  }
};
