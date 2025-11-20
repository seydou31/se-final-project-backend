const router = require("express").Router();
const auth = require('../middleware/auth');
const {
  createProfile,
  getProfile,
  updateProfile,
} = require("../controllers/profile");
const {
  validate,
  createProfileSchema,
  updateProfileSchema,
} = require('../middleware/validation');

router.post('/profile', auth, validate(createProfileSchema), createProfile);
router.get('/profile', auth, getProfile);
router.patch('/profile', auth, validate(updateProfileSchema), updateProfile);
module.exports = router;
