const profile = require("../models/profile");
const logger = require("../utils/logger");
const { NotFoundError } = require("../utils/customErrors");

module.exports.createProfile = async (req, res, next) => {
  const { name, age, gender, bio, interests, convoStarter } = req.body;

  try {
    const newProfile = await profile.create({
      name,
      age,
      gender,
      bio,
      interests,
      convoStarter,
      owner: req.user._id,
    });
    res.status(201).send(newProfile);
  } catch (err) {
    next(err);
  }
};

module.exports.getProfile = async (req, res, next) => {
  try {
    const userProfile = await profile.findOne({ owner: req.user._id }).orFail(() => {
      throw new NotFoundError("Profile not found");
    });
    logger.debug(`Profile found for user: ${req.user._id}`);
    res.status(200).send(userProfile);
  } catch (err) {
    next(err);
  }
};

module.exports.updateProfile = async (req, res, next) => {
  const { name, age, gender, bio, interests, convoStarter } = req.body;

  try {
    const updatedProfile = await profile
      .findOneAndUpdate(
        { owner: req.user._id },
        { name, age, gender, bio, interests, convoStarter },
        {
          new: true,
          runValidators: true,
        }
      )
      .orFail(() => {
        throw new NotFoundError("Profile not found");
      });
    res.send(updatedProfile);
  } catch (err) {
    next(err);
  }
};

 