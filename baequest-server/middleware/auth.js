const jwt = require('jsonwebtoken');
const User = require('../models/user');
const SECRET = require('../utils/config');
const logger = require('../utils/logger');

const handleAuthError = (res, message = 'Authorization Error', tokenExpired = false) => {
  res
    .status(401)
    .send({
      message,
      tokenExpired // Flag to help frontend distinguish expired vs invalid tokens
    });
};

module.exports = async (req, res, next) => {
  const token = req.cookies.jwt;

  if (!token) {
    return handleAuthError(res, 'No authentication token provided');
  }

  let payload;

  try {
    payload = jwt.verify(token, SECRET.JWT_SECRET);
  } catch (err) {
    logger.error('JWT verification failed:', err.message);

    // Check if token expired
    if (err.name === 'TokenExpiredError') {
      return handleAuthError(res, 'Token expired. Please refresh your session.', true);
    }

    // Invalid token (malformed, wrong signature, etc.)
    return handleAuthError(res, 'Invalid authentication token', false);
  }

  // Validate token version so that logout invalidates existing tokens
  const foundUser = await User.findById(payload._id).select('tokenVersion');
  if (!foundUser || foundUser.tokenVersion !== payload.tokenVersion) {
    return handleAuthError(res, 'Session is no longer valid. Please log in again.');
  }

  req.user = payload;

  return next();
};
