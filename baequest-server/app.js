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

const path = require('path');
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
const SECRET = require("./utils/config");

const REQUIRED_ENV_VARS = ['JWT_SECRET', 'MONGODB_URI'];
const missingVars = REQUIRED_ENV_VARS.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.error(`FATAL: Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

const { PORT = 3001 } = process.env;

const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = isProduction
  ? ["https://baequests.com", "https://baequest.cwsdev1.com"]
  : ["https://baequests.com", "https://baequest.cwsdev1.com", "http://localhost:3000", "http://localhost:5173"];

const app = express();
app.set('trust proxy', 1);
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
    // eslint-disable-next-line no-param-reassign
    socket.user = jwt.verify(token, SECRET.JWT_SECRET);
    return next();
  } catch {
    return next(new Error('Invalid token'));
  }
});

app.set("io", io);

io.on("connection", (socket) => {
  logger.info(`User connected: ${socket.id}`);
  logger.info(`Total clients: ${io.engine.clientsCount}`);

  // =============================
  // HELPER: SEND ERROR
  // =============================
  const sendError = (code, message, callback) => {
    const error = { code, message };

    // ACK response
    callback?.({ status: "error", ...error });

    // ALSO emit for global listener (frontend)
    socket.emit("error", error);
  };

  // =============================
  // JOIN EVENT
  // =============================
  socket.on("join-event", ({ eventId } = {}, callback) => {
    try {
      if (!eventId) {
        return sendError("INVALID_EVENT_ID", "eventId is required", callback);
      }

      const room = `event_${eventId}`;

      if (!socket.rooms.has(room)) {
        socket.join(room);
        logger.info(`${socket.id} joined ${room}`);
      }

      socket.data.eventId = eventId;

      callback?.({ status: "ok", eventId });

      socket.to(room).emit("user-joined", {
        socketId: socket.id,
        eventId,
      });

    } catch (err) {
      logger.error(`join-event error: ${err.message}`);
      sendError("JOIN_FAILED", "Failed to join event", callback);
    }
  });

  // =============================
  // LEAVE EVENT
  // =============================
  socket.on("leave-event", ({ eventId } = {}, callback) => {
    try {
      if (!eventId) {
        return sendError("INVALID_EVENT_ID", "eventId is required", callback);
      }

      const room = `event_${eventId}`;

      if (socket.rooms.has(room)) {
        socket.leave(room);
        logger.info(`${socket.id} left ${room}`);
      }

      socket.to(room).emit("user-left", {
        socketId: socket.id,
        eventId,
      });

      socket.data.eventId = null;

      callback?.({ status: "ok", eventId });

    } catch (err) {
      logger.error(`leave-event error: ${err.message}`);
      sendError("LEAVE_FAILED", "Failed to leave event", callback);
    }
  });

  // =============================
  // DISCONNECTING
  // =============================
  socket.on("disconnecting", () => {
    try {
      for (const room of socket.rooms) {
        if (room === socket.id) continue;

        const eventId = room.replace("event_", "");

        logger.info(`${socket.id} leaving ${room}`);

        socket.to(room).emit("user-left", {
          socketId: socket.id,
          eventId,
        });
      }
    } catch (err) {
      logger.error(`disconnecting error: ${err.message}`);
    }
  });

  // =============================
  // DISCONNECT
  // =============================
  socket.on("disconnect", (reason) => {
    logger.info(`Disconnected: ${socket.id} | ${reason}`);
    logger.info(`Total clients: ${io.engine.clientsCount}`);
  });

  // =============================
  // INTERNAL ERROR LOGGING
  // =============================
  socket.on("error", (err) => {
    logger.error(`Socket error (${socket.id}):`, err);
  });
});



app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },

  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],

      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://js.stripe.com",
        "https://accounts.google.com",
        "https://apis.google.com",
        "https://www.googletagmanager.com",
        "https://www.google-analytics.com"
      ],

      frameSrc: [
        "'self'",
        "https://js.stripe.com",
        "https://hooks.stripe.com",
        "https://accounts.google.com"
      ],

      connectSrc: [
        "'self'",
        "https://api.stripe.com",

        // Socket.IO (VERY IMPORTANT)
        "https://api.baequests.com",
        "wss://api.baequests.com",
        "http://localhost:3001",
        "ws://localhost:3001",

        // Analytics
        "https://www.google-analytics.com",
        "https://www.googletagmanager.com"
      ],

      imgSrc: [
        "'self'",
        "data:",
        "https://*.googleusercontent.com",
        "https://lh3.googleusercontent.com",
        "https://baequests-profile-pictures.s3.us-east-2.amazonaws.com",
        "https://www.googletagmanager.com"
      ],

      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com"
      ],

      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com"
      ]
    }
  }
}));

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(cookieParser());
app.use(requestLogger);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false }
});
app.use(limiter);
// Stripe webhook needs raw body — must be before express.json()
app.use('/stripe/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({
  limit: '50mb'
}));

app.use(express.urlencoded({
  extended: true,
  limit: '50mb'
}));

// Serve uploaded images publicly (event photos and profile pictures are shown to all users)
// app.use('/uploads', express.static('uploads'));
// Fix for image loading (CORP issue)
app.use('/uploads', (req, res, next) => {
  //res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, 'uploads')));

// Google login fix for CORP issue when Google tries to load profile picture
app.use('/google-profile-pictures', (req, res, next) => {
  //res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, 'google-profile-pictures')));

app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});

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

const { scheduleAutoCheckout } = require('./utils/checkoutScheduler');

mongoose
  .connect(MONGODB_URI, { dbName: 'baequest' })
  .then(() => {
    logger.info("Connected to MongoDB successfully");
    server.listen(PORT, () => {
      logger.info(`App + Socket.io listening on port ${PORT}`);
    });
    // Start the auto-checkout scheduler (pass io so it can emit event-ended)
    scheduleAutoCheckout(io);
  })
  .catch((err) => {
    // console.error ensures the message is visible in docker logs even if Winston fails
    console.error("FATAL: Failed to connect to MongoDB:", err.message);
    logger.error("Failed to connect to MongoDB", err);
    process.exit(1);
  });
