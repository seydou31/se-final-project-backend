const fs = require('fs').promises;
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const profile = require("../models/profile");
const logger = require("../utils/logger");
const { NotFoundError } = require("../utils/customErrors");
const { isS3Configured } = require('../middleware/multer');
const { encryptPhone, decryptPhone } = require('../utils/crypto');

module.exports.createProfile = async (req, res, next) => {
  const { name, age, gender, sexualOrientation, profession, bio, interests, convoStarter, phoneNumber } = req.body;

  try {
    const newProfile = await profile.create({
      name,
      age,
      gender,
      sexualOrientation,
      profession,
      bio,
      interests,
      convoStarter,
      phoneNumber: phoneNumber ? encryptPhone(phoneNumber) : phoneNumber,
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
    const profileObj = userProfile.toObject();
    if (profileObj.phoneNumber) {
      try { profileObj.phoneNumber = decryptPhone(profileObj.phoneNumber); } catch (e) { /* leave as-is */ }
    }
    res.status(200).send(profileObj);
  } catch (err) {
    next(err);
  }
};

module.exports.updateProfile = async (req, res, next) => {
  const { name, age, gender, sexualOrientation, profession, bio, interests, convoStarter, phoneNumber } = req.body;

  try {
    const updatedProfile = await profile
      .findOneAndUpdate(
        { owner: req.user._id },
        { name, age, gender, sexualOrientation, profession, bio, interests, convoStarter,
          phoneNumber: phoneNumber ? encryptPhone(phoneNumber) : phoneNumber },
        {
          new: true,
          runValidators: true,
        }
      )
      .orFail(() => {
        throw new NotFoundError("Profile not found");
      });
    const profileObj = updatedProfile.toObject();
    if (profileObj.phoneNumber) {
      try { profileObj.phoneNumber = decryptPhone(profileObj.phoneNumber); } catch (e) { /* leave as-is */ }
    }
    res.send(profileObj);
  } catch (err) {
    next(err);
  }
};

 module.exports.deleteProfile = async(req, res, next ) => {
   const userId = req.user._id;
   try{
         await profile.findOneAndDelete({owner : userId}).orFail(() => {
       throw new NotFoundError("profile not found")});
       res.status(200).json({ message: "profile deleted successfully" });
   } catch(err) {
     next(err);
   }
 }

module.exports.uploadProfilePicture = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // File has been validated and optimized by middleware
    // Now save to S3 or local disk
    let profilePictureUrl;
    const {secureFilename} = req;
    const fileBuffer = req.file.buffer;

    if (isS3Configured) {
      // Upload to S3
      const s3Client = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });

      const key = `profile-pictures/${secureFilename}`;

      const uploadParams = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: key,
        Body: fileBuffer,
        ContentType: req.validatedFileType.mime,
        Metadata: {
          uploadedBy: req.user._id.toString(),
          originalName: req.file.originalname,
        },
      };

      await s3Client.send(new PutObjectCommand(uploadParams));

      // Construct S3 URL
      profilePictureUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;

      logger.info(`Profile picture uploaded to S3: ${key}`);
    } else {
      // Save to local disk
      const uploadDir = path.join(__dirname, '..', 'uploads', 'profile-pictures');

      // Ensure directory exists
      await fs.mkdir(uploadDir, { recursive: true });

      const filePath = path.join(uploadDir, secureFilename);
      await fs.writeFile(filePath, fileBuffer);

      profilePictureUrl = `/uploads/profile-pictures/${secureFilename}`;

      logger.info(`Profile picture saved locally: ${secureFilename}`);
    }

    // Update the user's profile with the new profile picture URL
    const updatedProfile = await profile
      .findOneAndUpdate(
        { owner: req.user._id },
        { profilePicture: profilePictureUrl },
        { new: true, runValidators: true }
      )
      .orFail(() => {
        throw new NotFoundError("Profile not found");
      });

    return res.status(200).json({
      message: "Profile picture uploaded successfully",
      profilePicture: profilePictureUrl,
      profile: updatedProfile,
      storageType: isS3Configured ? 's3' : 'local',
      fileSize: req.file.size,
      mimeType: req.validatedFileType.mime
    });
  } catch (err) {
    logger.error('Profile picture upload error:', err);
    return next(err);
  }
};