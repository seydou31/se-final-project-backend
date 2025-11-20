const router = require('express').Router();
const userRouter = require('./users');
const {
  createUser,
  login,
  logout,
  getUsersAtEvent,
} = require("../controllers/users");
const {events, checkin, eventCheckout, fetchAndCreateEvents} = require('../controllers/event');
const auth = require('../middleware/auth');
const {
  validate,
  createUserSchema,
  loginSchema,
  checkinSchema,
  checkoutSchema,
  fetchGoogleEventsSchema,
} = require('../middleware/validation');

router.use('/users', userRouter);
router.post('/signup', validate(createUserSchema), createUser);
router.post('/signin', validate(loginSchema), login);
router.post('/logout', logout);
router.get('/events', auth, events);
router.post('/checkin', auth, validate(checkinSchema), checkin);
router.get('/otherUsers', auth, getUsersAtEvent);
router.post("/checkout", auth, validate(checkoutSchema), eventCheckout);
router.post('/fetch-google-events', auth, validate(fetchGoogleEventsSchema), fetchAndCreateEvents);
module.exports = router;