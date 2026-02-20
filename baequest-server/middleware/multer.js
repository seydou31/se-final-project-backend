const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3Client } = require('@aws-sdk/client-s3');
const path = require('path');
const logger = require('../utils/logger');

// File filter to accept only images
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
  }
};

// Check if AWS credentials are configured
const isS3Configured =
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_ACCESS_KEY_ID !== 'your_access_key_id_here' &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  process.env.AWS_SECRET_ACCESS_KEY !== 'your_secret_access_key_here' &&
  process.env.AWS_S3_BUCKET_NAME;

let storage;

if (isS3Configured) {
  // ===== AWS S3 STORAGE =====
  logger.info('✅ Using AWS S3 storage for uploads');

  // Configure AWS S3 Client
  const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  storage = multerS3({
    s3: s3Client,
    bucket: process.env.AWS_S3_BUCKET_NAME,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: (req, file, cb) => {
      cb(null, {
        fieldName: file.fieldname,
        uploadedBy: req.user._id.toString()
      });
    },
    key: (req, file, cb) => {
      // Create unique filename: userId-timestamp.extension
      const uniqueName = `profile-pictures/${req.user._id}-${Date.now()}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    }
  });
} else {
  // ===== LOCAL DISK STORAGE (Fallback) =====
  logger.info('⚠️  Using local disk storage for uploads (AWS not configured)');
  logger.info('📝 To use AWS S3, update your .env file with AWS credentials');

  storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'uploads/profile-pictures/');
    },
    filename: (req, file, cb) => {
      // Create unique filename: userId-timestamp.extension
      const uniqueName = `${req.user._id}-${Date.now()}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    }
  });
}

// Create multer instance with memory storage for validation
// Files are validated and optimized before saving to disk/S3
const upload = multer({
  storage: multer.memoryStorage(), // Use memory storage for validation
  fileFilter, // Basic filter (can be bypassed, so we validate in middleware)
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Export both the upload instance and storage config for later use
// NOTE: Don't use 'storage' as property name - it would overwrite multer's internal storage!
module.exports = upload;
module.exports.isS3Configured = isS3Configured;
module.exports.s3Storage = storage;  // Renamed to avoid overwriting multer's internal .storage
