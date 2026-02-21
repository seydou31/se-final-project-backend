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
const {
  validate,
  createUserSchema,
  loginSchema,
} = require('../middleware/validation');

router.use('/users', userRouter);
router.post('/signup', validate(createUserSchema), createUser);
router.post('/signin', validate(loginSchema), login);
router.post('/logout', logout);
router.post('/refresh-token', refreshToken);
router.post('/auth/google', googleAuth);
router.post('/auth/google/token', googleAuthWithToken);
router.post('/password-reset/request', requestPasswordReset);
router.post('/password-reset/reset', resetPassword);
router.post('/email-verification/send', sendVerification);
router.post('/email-verification/verify', verifyEmail);

router.delete('/deleteUser', auth, deleteUser);

// Curated events routes
const curatedEventsRouter = require('./curatedEvents');

router.use('/events', curatedEventsRouter);

// Event feedback routes
const eventFeedbackRouter = require('./eventFeedback');

router.use('/events', eventFeedbackRouter);

module.exports = router;
