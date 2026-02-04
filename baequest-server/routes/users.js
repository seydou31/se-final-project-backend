const router = require("express").Router();
const auth = require('../middleware/auth');
const upload = require('../middleware/multer');
const { validateFileType, optimizeImage, sanitizeFilename } = require('../middleware/fileValidation');
const {
  createProfile,
  getProfile,
  updateProfile,
  deleteProfile,
  uploadProfilePicture
} = require("../controllers/profile");
const {
  validate,
  createProfileSchema,
  updateProfileSchema,
} = require('../middleware/validation');

router.post('/profile', auth, validate(createProfileSchema), createProfile);
router.get('/profile', auth, getProfile);
router.patch('/profile', auth, validate(updateProfileSchema), updateProfile);
router.delete('/profile', auth, deleteProfile);

// Profile picture upload with security: validate file type, optimize image, sanitize filename
router.post(
  '/profile/picture',
  auth,
  upload.single('profilePicture'),
  validateFileType,
  optimizeImage,
  sanitizeFilename,
  uploadProfilePicture
);

module.exports = router;
