const router = require('express').Router();
const {
  register,
  login,
  getMe,
  getDashboard,
  getStripeOnboardingLink,
  verifyStripeOnboarding,
  getDashboardStats,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
} = require('../controllers/eventManagers');
const authEventManager = require('../middleware/authEventManager');
const { authLimiter } = require('../middleware/rateLimiter');

router.post('/signup', authLimiter, register);
router.post('/signin', authLimiter, login);
router.get('/me', authEventManager, getMe);
router.get('/dashboard', authEventManager, getDashboard);
router.post('/stripe/onboard', authEventManager, getStripeOnboardingLink);
router.post('/stripe/verify', authEventManager, verifyStripeOnboarding);

router.get('/dashboard/stats', authEventManager, getDashboardStats);

router.get('/events', authEventManager, getEvents);

router.get('/events/:id', authEventManager, getEventById);

router.put('/events/:id', authEventManager, updateEvent);

router.delete('/events/:id', authEventManager, deleteEvent);

module.exports = router;
