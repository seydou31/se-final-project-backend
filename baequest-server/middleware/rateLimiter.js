const rateLimit = require('express-rate-limit');

// Strict limiter for auth endpoints — 20 requests per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Too many attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Check-in limiter — 10 check-ins per hour per IP
const checkinLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { message: 'Check-in rate limit exceeded, please wait before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { authLimiter, checkinLimiter };
