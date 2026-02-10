const { fileTypeFromBuffer } = require('file-type');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');

// Allowed MIME types for profile pictures
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
];

// Maximum file size (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Validate uploaded file by checking actual file content (not just extension/mimetype)
 * This prevents malicious files disguised as images
 */
const validateFileType = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Debug logging to understand req.file structure
    logger.info('File upload received:', JSON.stringify({
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      hasBuffer: !!req.file.buffer,
      bufferLength: req.file.buffer ? req.file.buffer.length : 0,
      hasPath: !!req.file.path,
      path: req.file.path || null,
      hasLocation: !!req.file.location,
      encoding: req.file.encoding
    }));

    // For S3 uploads, we need to validate before upload
    // For local uploads, file is already saved, so we validate then delete if invalid

    let fileBuffer;

    if (req.file.buffer) {
      // File is in memory (memory storage)
      fileBuffer = req.file.buffer;
    } else if (req.file.path) {
      // File is on disk (disk storage)
      fileBuffer = await fs.readFile(req.file.path);
    } else {
      logger.error('File upload missing both buffer and path:', JSON.stringify(req.file));
      return res.status(500).json({ error: 'Unable to read uploaded file' });
    }

    // Check actual file type from file content (magic numbers)
    const fileType = await fileTypeFromBuffer(fileBuffer);

    if (!fileType) {
      // Clean up file if it exists
      if (req.file.path) {
        await fs.unlink(req.file.path).catch(() => {});
      }
      return res.status(400).json({
        error: 'Invalid file: Unable to determine file type'
      });
    }

    // Verify the actual MIME type matches allowed types
    if (!ALLOWED_MIME_TYPES.includes(fileType.mime)) {
      // Clean up file if it exists
      if (req.file.path) {
        await fs.unlink(req.file.path).catch(() => {});
      }
      return res.status(400).json({
        error: `Invalid file type: ${fileType.mime}. Only JPEG, PNG, WebP, and GIF images are allowed.`
      });
    }

    // Check file size
    const fileSize = req.file.size || fileBuffer.length;
    if (fileSize > MAX_FILE_SIZE) {
      // Clean up file if it exists
      if (req.file.path) {
        await fs.unlink(req.file.path).catch(() => {});
      }
      return res.status(400).json({
        error: `File too large: ${(fileSize / (1024 * 1024)).toFixed(2)}MB. Maximum size is 5MB.`
      });
    }

    // Store the validated file type for later use
    req.validatedFileType = fileType;

    logger.info(`File validated: ${fileType.mime}, size: ${(fileSize / 1024).toFixed(2)}KB`);
    next();
  } catch (error) {
    logger.error('File validation error:', error);

    // Clean up file if it exists
    if (req.file && req.file.path) {
      await fs.unlink(req.file.path).catch(() => {});
    }

    res.status(500).json({ error: 'File validation failed' });
  }
};

/**
 * Optimize and sanitize image files
 * - Resize large images
 * - Strip metadata (EXIF data that may contain location/privacy info)
 * - Convert to WebP for better compression (optional)
 * - Compress to reduce file size
 */
const optimizeImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return next();
    }

    let fileBuffer;

    if (req.file.buffer) {
      fileBuffer = req.file.buffer;
    } else if (req.file.path) {
      fileBuffer = await fs.readFile(req.file.path);
    } else {
      return next();
    }

    // Use sharp to process the image
    let processedImage = sharp(fileBuffer);

    // Get image metadata
    const metadata = await processedImage.metadata();

    // Resize if image is too large (max 1200px width, maintaining aspect ratio)
    if (metadata.width > 1200) {
      processedImage = processedImage.resize(1200, null, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // Strip all metadata (EXIF data) for privacy and security
    processedImage = processedImage.rotate(); // Auto-rotate based on EXIF orientation

    // Convert to WebP for better compression (optional - can be toggled)
    const useWebP = process.env.CONVERT_TO_WEBP === 'true';

    if (useWebP && req.validatedFileType.mime !== 'image/gif') {
      // Don't convert GIFs to WebP as it loses animation
      processedImage = processedImage.webp({ quality: 85 });
      req.optimizedExtension = '.webp';
    } else {
      // Keep original format but optimize
      if (req.validatedFileType.mime === 'image/jpeg') {
        processedImage = processedImage.jpeg({ quality: 85, progressive: true });
      } else if (req.validatedFileType.mime === 'image/png') {
        processedImage = processedImage.png({ compressionLevel: 9 });
      }
      req.optimizedExtension = path.extname(req.file.originalname);
    }

    // Get the optimized buffer
    const optimizedBuffer = await processedImage.toBuffer();

    // Update req.file with optimized image
    req.file.buffer = optimizedBuffer;
    req.file.size = optimizedBuffer.length;

    // If file was saved to disk, replace it with optimized version
    if (req.file.path) {
      await fs.writeFile(req.file.path, optimizedBuffer);
    }

    const originalSize = fileBuffer.length;
    const newSize = optimizedBuffer.length;
    const savings = ((originalSize - newSize) / originalSize * 100).toFixed(1);

    logger.info(`Image optimized: ${(originalSize / 1024).toFixed(2)}KB → ${(newSize / 1024).toFixed(2)}KB (${savings}% reduction)`);

    next();
  } catch (error) {
    logger.error('Image optimization error:', error);

    // Clean up file if it exists
    if (req.file && req.file.path) {
      await fs.unlink(req.file.path).catch(() => {});
    }

    res.status(500).json({ error: 'Image processing failed' });
  }
};

/**
 * Generate a secure, sanitized filename
 * Prevents directory traversal attacks and ensures unique names
 */
const sanitizeFilename = (req, res, next) => {
  if (!req.file) {
    return next();
  }

  // Generate secure filename: userId-timestamp-random.ext
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const extension = req.optimizedExtension || path.extname(req.file.originalname);

  // Remove any path traversal attempts
  const safeExtension = extension.replace(/\.\./g, '').replace(/\//g, '');

  const secureFilename = `${req.user._id}-${timestamp}-${random}${safeExtension}`;

  // Update the filename
  req.file.filename = secureFilename;
  req.secureFilename = secureFilename;

  logger.debug(`Generated secure filename: ${secureFilename}`);

  next();
};

module.exports = {
  validateFileType,
  optimizeImage,
  sanitizeFilename
};
