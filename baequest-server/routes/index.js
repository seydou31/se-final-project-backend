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
const {
  getNearbyPlaces,
  getPlacePhoto,
  getUserCountAtPlace,
  checkinAtPlace,
  checkoutFromPlace,
  getUsersAtPlace
} = require('../controllers/places');
const {requestPasswordReset, resetPassword} = require('../controllers/passwordReset');
const {sendVerification, verifyEmail} = require('../controllers/emailVerification');
const { createEvent, getNearbyEvents } = require('../controllers/curatedEvents');
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

// Places routes (replaced events)
router.get('/places/nearby', auth, getNearbyPlaces);
router.get('/places/photo', getPlacePhoto);
router.get('/places/:placeId/count', auth, getUserCountAtPlace);
router.post('/places/checkin', auth, checkinAtPlace);
router.post('/places/checkout', auth, checkoutFromPlace);
router.get('/places/users', auth, getUsersAtPlace);

router.delete('/deleteUser', auth, deleteUser);

// Curated events routes (public - no auth)
router.post('/events', createEvent);
router.get('/events/nearby', getNearbyEvents);

module.exports = router;
