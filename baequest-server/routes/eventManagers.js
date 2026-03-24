const router = require('express').Router();
const {
  register,
  login,
  getMe,
  getDashboard,
  getStripeOnboardingLink,
  verifyStripeOnboarding,
} = require('../controllers/eventManagers');
const authEventManager = require('../middleware/authEventManager');
const { authLimiter } = require('../middleware/rateLimiter');

router.post('/signup', authLimiter, register);
router.post('/signin', authLimiter, login);
router.get('/me', authEventManager, getMe);
router.get('/dashboard', authEventManager, getDashboard);
router.post('/stripe/onboard', authEventManager, getStripeOnboardingLink);
router.post('/stripe/verify', authEventManager, verifyStripeOnboarding);

module.exports = router;
