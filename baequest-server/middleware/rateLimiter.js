const rateLimit = require('express-rate-limit');

const skipInTest = () => process.env.NODE_ENV === 'test';

// Strict limiter for auth endpoints — 20 requests per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skip: skipInTest,
  message: { message: 'Too many attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Check-in limiter — 10 check-ins per hour per IP
const checkinLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  skip: skipInTest,
  message: { message: 'Check-in rate limit exceeded, please wait before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Passphrase limiter — 5 event creation attempts per 15 minutes per IP
const passphraseLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skip: skipInTest,
  message: { message: 'Too many event creation attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { authLimiter, checkinLimiter, passphraseLimiter };
