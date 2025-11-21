const jwt = require("jsonwebtoken");
const user = require("../models/user");
const profile = require("../models/profile");
const bcrypt = require("bcryptjs");
const SECRET = require("../utils/config");
const {
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
  ConflictError,
} = require("../utils/customErrors");

module.exports.createUser = async (req, res, next) => {
  const { name, avatar, email, password } = req.body;

  try {
    const existing = await user.findOne({ email });
    if (existing) {
      throw new ConflictError("A user with this email already exists");
    }

    const hash = await bcrypt.hash(password, 10);
    const newUser = await user.create({ name, avatar, email, password: hash });
    const userObject = newUser.toObject();
    delete userObject.password;
    return res.status(201).send(userObject);
  } catch (err) {
    next(err);
  }
};

module.exports.getUser = async (req, res, next) => {
  const { userId } = req.params;

  try {
    const foundUser = await user.findById(userId).orFail(() => {
      throw new NotFoundError("User not found");
    });
    res.status(200).send(foundUser);
  } catch (err) {
    next(err);
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

module.exports.getUsersAtEvent = async (req, res, next) => {
  const { eventId } = req.query;
  const userId = req.user._id;

  try {
    const users = await profile.find({
      "location.eventId": eventId,
      owner: { $ne: userId },
    }).select("name bio interests location convoStarter");

    res.json(users);
  } catch (err) {
    next(err);
  }
};