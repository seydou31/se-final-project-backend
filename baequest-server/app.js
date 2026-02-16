require("dotenv").config();
const Sentry = require("@sentry/node");

// Initialize Sentry before other imports
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: 0.1, // 10% of transactions for performance monitoring
    ignoreErrors: [
      "UnauthorizedError", // Don't report auth failures as errors
      "NotFoundError",
    ],
  });
}

const http = require("http");
const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const { Server } = require("socket.io");
const mainRoute = require("./routes/index");
const STATUS = require("./utils/errors");
const errorHandler = require("./middleware/errorHandler");
const logger = require("./utils/logger");
const requestLogger = require("./middleware/requestLogger");
const profile = require("./models/profile");

const { PORT = 3001 } = process.env;


const app = express();
app.set('trust proxy', true);
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["https://baequests.com", "http://localhost:3000", "http://localhost:5173"],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.set("io", io);

io.on("connection", (socket) => {
  logger.info(`✅ User connected: ${socket.id}`);
  logger.info(`Total connected clients: ${io.engine.clientsCount}`);

  socket.on("join-place", ({ placeId }) => {
    socket.join(`place_${placeId}`);
    logger.info(`${socket.id} joined room place_${placeId}`);
  });

  socket.on("leave-place", ({ placeId }) => {
    socket.leave(`place_${placeId}`);
    logger.info(`${socket.id} left room place_${placeId}`);
  });

  socket.on("disconnect", () => {
    logger.info(`❌ User disconnected: ${socket.id}`);
    logger.info(`Total connected clients: ${io.engine.clientsCount}`);
  });
});



app.use(cors({ origin: ["https://baequests.com", "http://localhost:3000", "http://localhost:5173"], credentials: true }));
app.use(cookieParser());
app.use(helmet());
app.use(requestLogger);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500, // Increased for development; adjust for production
  standardHeaders: true,
  legacyHeaders: false,
  // Trust proxy is enabled, so validate it
  validate: { trustProxy: false }
});
app.use(limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files for uploaded images
app.use('/uploads', express.static('uploads'));

app.use("/", mainRoute);

app.use((req, res) => {
  res
    .status(STATUS.NOT_FOUND)
    .json({ message: "Requested resource not found" });
});

// Sentry error handler - must be before other error handlers
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

app.use(errorHandler);

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/baequest-db";

// Auto-checkout all users at 2am daily
function scheduleAutoCheckout() {
  const now = new Date();
  const next2am = new Date();
  next2am.setHours(2, 0, 0, 0);

  // If it's past 2am today, schedule for tomorrow
  if (now >= next2am) {
    next2am.setDate(next2am.getDate() + 1);
  }

  const msUntil2am = next2am.getTime() - now.getTime();

  setTimeout(async () => {
    try {
      const result = await profile.updateMany(
        { "location.placeId": { $exists: true, $ne: null } },
        { $unset: { "location.placeId": "", "location.placeName": "", "location.placeAddress": "" } }
      );
      logger.info(`Auto-checkout at 2am: ${result.modifiedCount} users checked out`);
    } catch (err) {
      logger.error("Auto-checkout failed:", err);
    }
    // Reschedule for next day
    scheduleAutoCheckout();
  }, msUntil2am);

  logger.info(`Auto-checkout scheduled for ${next2am.toLocaleString()}`);
}

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    logger.info("Connected to MongoDB successfully");
    server.listen(PORT, () => {
      logger.info(`App + Socket.io listening on port ${PORT}`);
    });
    // Start the auto-checkout scheduler
    scheduleAutoCheckout();
  })
  .catch((err) => {
    logger.error("Failed to connect to MongoDB", err);
    process.exit(1);
  });
