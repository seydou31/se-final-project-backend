const router = require('express').Router();
const userRouter = require('./users');
const eventFeedbackRouter = require('./eventFeedback');
const {
  createUser,
  login,
  logout,
  refreshToken,
  getUsersAtEvent,
  deleteUser,
  googleAuth,
  googleAuthWithToken
} = require("../controllers/users");
const {events, checkin, eventCheckout, markAsGoing, myEvents} = require('../controllers/event');
const {requestPasswordReset, resetPassword} = require('../controllers/passwordReset');
const {sendVerification, verifyEmail} = require('../controllers/emailVerification');
const auth = require('../middleware/auth');
const {
  validate,
  createUserSchema,
  loginSchema,
  checkinSchema,
  checkoutSchema,
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
router.get('/events', auth, events);
router.get('/my-events', auth, myEvents);
router.post('/checkin', auth, validate(checkinSchema), checkin);
router.get('/otherUsers', auth, getUsersAtEvent);
router.post("/checkout", auth, validate(checkoutSchema), eventCheckout);
router.post('/going', auth, markAsGoing);
router.delete('/deleteUser', auth, deleteUser);

// Event feedback routes
router.use('/events', eventFeedbackRouter);

module.exports = router;
