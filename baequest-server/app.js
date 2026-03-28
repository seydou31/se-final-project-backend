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
    // eslint-disable-next-line no-param-reassign
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



app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(cookieParser());
app.use(requestLogger);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  // Trust proxy is enabled via app.set('trust proxy', true)
  validate: { trustProxy: true }
});
app.use(limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images only to authenticated users
app.use('/uploads', (req, res, next) => {
  const token = req.cookies.jwt;
  if (!token) return res.status(401).json({ message: 'Not authorized' });
  try {
    jwt.verify(token, SECRET.JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ message: 'Not authorized' });
  }
}, express.static('uploads'));

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
  .connect(MONGODB_URI)
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
