const router = require('express').Router();
const userRouter = require('./users');
const {
  createUser,
  login,
  logout,
  refreshToken,
  deleteUser,
  googleAuth,
  googleAuthWithToken
} = require("../controllers/users");
const {requestPasswordReset, resetPassword} = require('../controllers/passwordReset');
const {sendVerification, verifyEmail} = require('../controllers/emailVerification');
const auth = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const {
  validate,
  createUserSchema,
  loginSchema,
} = require('../middleware/validation');

router.use('/users', userRouter);
router.post('/signup', authLimiter, validate(createUserSchema), createUser);
router.post('/signin', authLimiter, validate(loginSchema), login);
router.post('/logout', logout);
router.post('/refresh-token', refreshToken);
router.post('/auth/google', authLimiter, googleAuth);
router.post('/auth/google/token', authLimiter, googleAuthWithToken);
router.post('/password-reset/request', authLimiter, requestPasswordReset);
router.post('/password-reset/reset', authLimiter, resetPassword);
router.post('/email-verification/send', authLimiter, sendVerification);
router.post('/email-verification/verify', authLimiter, verifyEmail);

router.delete('/deleteUser', auth, deleteUser);

// Curated events routes
const curatedEventsRouter = require('./curatedEvents');

router.use('/events', curatedEventsRouter);

// Event feedback routes
const eventFeedbackRouter = require('./eventFeedback');

router.use('/events', eventFeedbackRouter);

module.exports = router;
