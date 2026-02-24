const router = require("express").Router();
const { createEvent, getNearbyEvents, getEvents, markAsGoing, checkinAtEvent, checkoutFromEvent, getUsersAtEvent } = require("../controllers/curatedEvents");
const auth = require("../middleware/auth");
const authOrPassphrase = require("../middleware/authOrPassphrase");
const { checkinLimiter, passphraseLimiter } = require("../middleware/rateLimiter");
const upload = require("../middleware/multer");
const { validate, createEventSchema } = require("../middleware/validation");

// Event creation — requires login OR valid event manager passphrase (X-Event-Passphrase header)
router.post("/", passphraseLimiter, authOrPassphrase, upload.single("photo"), validate(createEventSchema), createEvent);
router.get("/nearby", getNearbyEvents);

// Protected routes - auth required
router.get("/", auth, getEvents);
router.post("/:id/going", auth, markAsGoing);
router.post("/:id/checkin", checkinLimiter, auth, checkinAtEvent);
router.post("/:id/checkout", auth, checkoutFromEvent);
router.get("/:id/users", auth, getUsersAtEvent);

module.exports = router;
