const router = require("express").Router();
const { createEvent, getNearbyEvents, getEvents, markAsGoing, checkinAtEvent, checkoutFromEvent, getUsersAtEvent, heartbeat } = require("../controllers/curatedEvents");
const auth = require("../middleware/auth");
const authEventManager = require("../middleware/authEventManager");
const { checkinLimiter } = require("../middleware/rateLimiter");
const upload = require("../middleware/multer");
const { validate, createEventSchema } = require("../middleware/validation");

// Event creation — requires event manager account
router.post("/", authEventManager, upload.single("photo"), validate(createEventSchema), createEvent);
router.get("/nearby", getNearbyEvents);

// Protected routes - auth required
router.get("/", auth, getEvents);
router.post("/:id/going", auth, markAsGoing);
router.post("/:id/checkin", auth, checkinLimiter, checkinAtEvent);
router.post("/:id/checkout", auth, checkoutFromEvent);
router.post("/:id/heartbeat", auth, heartbeat);
router.get("/:id/users", auth, getUsersAtEvent);

module.exports = router;
