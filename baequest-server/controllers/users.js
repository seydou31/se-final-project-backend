const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const user = require("../models/user");
const profile = require("../models/profile");
const EmailVerification = require("../models/emailVerification");
const SECRET = require("../utils/config");
const {
  UnauthorizedError, BadRequestError, NotFoundError,
  ConflictError
} = require("../utils/customErrors");
const { sendVerificationEmail } = require("../utils/email");
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
    console.log('✅ User created:', newUser._id);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(verificationToken)
      .digest('hex');
    console.log('✅ Token generated');

    // Create verification document with 24-hour expiration
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const verificationDoc = await EmailVerification.create({
      userId: newUser._id,
      token: hashedToken,
      expiresAt,
    });
    console.log('✅ Verification document created:', verificationDoc._id);

    // Send verification email
    try {
      const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${verificationToken}`;
      await sendVerificationEmail(email, verificationUrl);
      console.log('✅ Verification email sent to:', email);
    } catch (emailError) {
      logger.error('Failed to send verification email:', emailError);
      console.log('❌ Email sending failed:', emailError.message);
      // Don't fail signup if email fails - user can request resend later
    }

    const userObject = newUser.toObject();
    delete userObject.password;
    return res.status(201).send({
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
    next(new BadRequestError(err.message));
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

    res
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
    next(new UnauthorizedError("Invalid or expired token"));
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
    let genderFilter = {};

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
    const filteredUsers = users.filter(user => {
      // If current user is bisexual, they can see everyone
      if (sexualOrientation === 'bisexual') {
        return true;
      }

      // Check if the other user would also want to see current user
      if (user.sexualOrientation === 'straight') {
        // Straight users want opposite gender
        return user.gender !== userGender;
      } else if (user.sexualOrientation === 'gay') {
        // Gay users want same gender
        return user.gender === userGender;
      } else if (user.sexualOrientation === 'bisexual') {
        // Bisexual users are compatible with everyone
        return true;
      }

      return false;
    });

    res.json(filteredUsers);
  } catch (err) {
    next(err);
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
  const { OAuth2Client } = require("google-auth-library");
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

  try {
    // Verify the Google token
    const client = new OAuth2Client(GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const googleId = payload.sub;
    const email = payload.email;

    // Check if user exists
    let foundUser = await user.findOne({ $or: [{ googleId }, { email }] });

    if (!foundUser) {
      // Create new user with Google ID - email is already verified by Google
      foundUser = await user.create({
        email,
        googleId,
        isEmailVerified: true,
      });
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
    next(new UnauthorizedError("Google authentication failed: " + err.message));
  }
};
