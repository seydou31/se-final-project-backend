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
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const mainRoute = require("./routes/index");
const STATUS = require("./utils/errors");
const errorHandler = require("./middleware/errorHandler");
const logger = require("./utils/logger");
const requestLogger = require("./middleware/requestLogger");
const profile = require("./models/profile");
const CuratedEvent = require("./models/curatedEvent");
const SECRET = require("./utils/config");

const { PORT = 3001 } = process.env;

const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = isProduction
  ? ["https://baequests.com"]
  : ["https://baequests.com", "http://localhost:3000", "http://localhost:5173"];

const app = express();
app.set('trust proxy', true);
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Require valid JWT for all Socket.IO connections
io.use((socket, next) => {
  const cookieHeader = socket.handshake.headers.cookie || '';
  const jwtMatch = cookieHeader.split(';').find(c => c.trim().startsWith('jwt='));
  const token = jwtMatch ? jwtMatch.trim().slice(4) : null;
  if (!token) return next(new Error('Authentication required'));
  try {
    socket.user = jwt.verify(token, SECRET.JWT_SECRET);
    return next();
  } catch {
    return next(new Error('Invalid token'));
  }
});

app.set("io", io);

io.on("connection", (socket) => {
  logger.info(`✅ User connected: ${socket.id}`);
  logger.info(`Total connected clients: ${io.engine.clientsCount}`);

  socket.on("join-event", ({ eventId }) => {
    socket.join(`event_${eventId}`);
    logger.info(`${socket.id} joined room event_${eventId}`);
  });

  socket.on("leave-event", ({ eventId }) => {
    socket.leave(`event_${eventId}`);
    logger.info(`${socket.id} left room event_${eventId}`);
  });

  socket.on("disconnect", () => {
    logger.info(`❌ User disconnected: ${socket.id}`);
    logger.info(`Total connected clients: ${io.engine.clientsCount}`);
  });
});



app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(cookieParser());
app.use(helmet());
app.use(requestLogger);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500, // Increased for development; adjust for production
  standardHeaders: true,
  legacyHeaders: false,
  // Trust proxy is enabled via app.set('trust proxy', true)
  validate: { trustProxy: true }
});
app.use(limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files for uploaded images
app.use('/uploads', express.static('uploads'));

app.use("/", mainRoute);

// Health check endpoint for Docker HEALTHCHECK and load balancers
app.get("/health", (req, res) => {
  const mongoStatus = mongoose.connection.readyState;
  if (mongoStatus !== 1) {
    return res.status(503).json({ status: "unhealthy", mongo: "disconnected" });
  }
  return res.status(200).json({ status: "healthy", mongo: "connected" });
});

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
      // Clear event check-ins from profiles
      const profileResult = await profile.updateMany(
        { "location.eventId": { $exists: true, $ne: null } },
        { $unset: { "location.eventId": "", "location.lat": "", "location.lng": "" }, $set: { "location.updatedAt": new Date() } }
      );
      // Clear checkedInUsers arrays on all events
      const eventResult = await CuratedEvent.updateMany(
        { checkedInUsers: { $exists: true, $not: { $size: 0 } } },
        { $set: { checkedInUsers: [] } }
      );
      logger.info(`Auto-checkout at 2am: ${profileResult.modifiedCount} users checked out, ${eventResult.modifiedCount} events cleared`);
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
    // console.error ensures the message is visible in docker logs even if Winston fails
    console.error("FATAL: Failed to connect to MongoDB:", err.message);
    logger.error("Failed to connect to MongoDB", err);
    process.exit(1);
  });
