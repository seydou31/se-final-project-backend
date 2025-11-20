const logger = require("../utils/logger");

const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  logger.http(`Incoming ${req.method} ${req.originalUrl}`, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get("user-agent"),
  });

  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 400 ? "warn" : "http";

    logger.log(logLevel, `${req.method} ${req.originalUrl} ${res.statusCode}`, {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.connection.remoteAddress,
    });
  });

  next();
};

module.exports = requestLogger;
