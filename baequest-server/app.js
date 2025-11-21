require("dotenv").config();
const cors = require("cors");
const { PORT = 3001 } = process.env;
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const { seedEvents } = require("./utils/seedEvents");
const mainRoute = require("./routes/index");
const STATUS = require("./utils/errors");
const http = require("http");
const { Server } = require("socket.io");
const event = require("./models/event");
const profile = require("./models/profile");
const errorHandler = require("./middleware/errorHandler");
const logger = require("./utils/logger");
const requestLogger = require("./middleware/requestLogger"); 


const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.set("io", io);

io.on("connection", (socket) => {
  logger.info(`User connected: ${socket.id}`);

  socket.on("join-event", ({ eventId }) => {
    socket.join(`event_${eventId}`);
    logger.info(`${socket.id} joined room event_${eventId}`);
  });

  socket.on("leave-event", ({ eventId }) => {
    socket.leave(`event_${eventId}`);
    logger.info(`${socket.id} left room event_${eventId}`);
  });

  socket.on("disconnect", () => {
    logger.info(`User disconnected: ${socket.id}`);
  });
});

setInterval(async () => {
  try {
    const now = new Date();
    const justExpired = await event.find({
      endTime: {
        $lte: now,
        $gt: new Date(now.getTime() - 1000)
      }
    });

    for (const expiredEvent of justExpired) {
      logger.info(`Event expired: ${expiredEvent.title} (${expiredEvent._id})`);

      io.emit("event-expired", {
        eventId: expiredEvent._id
      });

      const usersAtEvent = await profile.find({
        "location.eventId": expiredEvent._id
      });

      for (const userProfile of usersAtEvent) {
        await profile.findByIdAndUpdate(userProfile._id, {
          $unset: { "location.eventId": "" }
        });

        io.to(`event_${expiredEvent._id}`).emit("force-checkout", {
          message: "This event has ended",
          eventId: expiredEvent._id
        });
      }
    }
  } catch (err) {
    logger.error("Error checking expired events:", err);
  }
}, 1000);



app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(cookieParser());
app.use(helmet());
app.use(requestLogger);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use(limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/", mainRoute);

app.use((req, res) => {
  res
    .status(STATUS.NOT_FOUND)
    .json({ message: "Requested resource not found" });
});

app.use(errorHandler);

mongoose
  .connect("mongodb://127.0.0.1:27017/baequest-db")
  .then(async () => {
    logger.info("Connected to MongoDB successfully");
    await seedEvents();
    server.listen(PORT, () => {
      logger.info(`App + Socket.io listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    logger.error("Failed to connect to MongoDB", err);
    process.exit(1);
  });
