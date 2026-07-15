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
const { sendUserReportEmail } = require('../utils/email');
const Profile = require('../models/profile');

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

router.post('/report/:reportedUserId', auth, async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'Reason is required' });

    const reporterProfile = await Profile.findOne({ owner: req.user.userId }).lean();
    const reportedProfile = await Profile.findOne({ owner: req.params.reportedUserId }).lean();

    if (!reportedProfile) return res.status(404).json({ error: 'User not found' });

    await sendUserReportEmail({
      reporterName: reporterProfile?.name || 'Unknown',
      reporterEmail: req.user.email || 'Unknown',
      reportedName: reportedProfile.name,
      reportedId: req.params.reportedUserId,
      reason,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

module.exports = router;
