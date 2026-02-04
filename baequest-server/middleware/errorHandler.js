const STATUS = require("../utils/errors");
const logger = require("../utils/logger");

const errorHandler = (err, req, res, next) => {
  logger.error("Error caught by error handler:", {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
  });

  if (err.statusCode) {
    return res.status(err.statusCode).json({
      message: err.message,
      error: err.name,
    });
  }

  if (err.name === "ValidationError") {
    return res.status(STATUS.BAD_REQUEST).json({
      message: err.message,
      error: "ValidationError",
    });
  }

  if (err.name === "CastError") {
    return res.status(STATUS.BAD_REQUEST).json({
      message: "Invalid ID format",
      error: "CastError",
    });
  }

  if (err.name === "DocumentNotFoundError") {
    return res.status(STATUS.NOT_FOUND).json({
      message: err.message || "Resource not found",
      error: "NotFoundError",
    });
  }

  if (err.code === 11000) {
    return res.status(STATUS.EXISTING_EMAIL_ERROR).json({
      message: "A user with this email already exists",
      error: "DuplicateKeyError",
    });
  }

  if (err.name === "JsonWebTokenError") {
    return res.status(STATUS.UNAUTHORIZED).json({
      message: "Invalid token",
      error: "JsonWebTokenError",
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(STATUS.UNAUTHORIZED).json({
      message: "Token expired",
      error: "TokenExpiredError",
    });
  }

  return res.status(STATUS.INTERNAL_SERVER_ERROR).json({
    message: err.message || "An error occurred on the server",
    error: "InternalServerError",
  });
};

module.exports = errorHandler;
