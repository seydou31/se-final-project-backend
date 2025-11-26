const jwt = require('jsonwebtoken');
const SECRET = require('../utils/config');
const logger = require('../utils/logger');

const handleAuthError = (res) => {
  res
    .status(401)
    .send({ message: 'Authorization Error' });
};

module.exports = (req, res, next) => {
  const token = req.cookies.jwt;

  if (!token) {
    return handleAuthError(res);
  }

  let payload;

  try {
    payload = jwt.verify(token, SECRET.JWT_SECRET);
  } catch (err) {
    logger.error('JWT verification failed:', err);
    return handleAuthError(res);
  }

  req.user = payload;

  return next();
};
