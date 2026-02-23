const router = require("express").Router();
const { createEvent, getNearbyEvents, getEvents, markAsGoing, checkinAtEvent, checkoutFromEvent, getUsersAtEvent } = require("../controllers/curatedEvents");
const auth = require("../middleware/auth");
const authOrPassphrase = require("../middleware/authOrPassphrase");
const { checkinLimiter } = require("../middleware/rateLimiter");
const upload = require("../middleware/multer");

// Event creation — requires login OR valid event manager passphrase (X-Event-Passphrase header)
router.post("/", authOrPassphrase, upload.single("photo"), createEvent);
router.get("/nearby", getNearbyEvents);

// Protected routes - auth required
router.get("/", auth, getEvents);
router.post("/:id/going", auth, markAsGoing);
router.post("/:id/checkin", checkinLimiter, auth, checkinAtEvent);
router.post("/:id/checkout", auth, checkoutFromEvent);
router.get("/:id/users", auth, getUsersAtEvent);

module.exports = router;
