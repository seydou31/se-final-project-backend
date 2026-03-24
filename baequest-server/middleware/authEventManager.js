const jwt = require('jsonwebtoken');
const User = require('../models/user');
const SECRET = require('../utils/config');

module.exports = async (req, res, next) => {
  const token = req.cookies.jwt;
  if (!token) return res.status(401).json({ message: 'No authentication token provided' });

  let payload;
  try {
    payload = jwt.verify(token, SECRET.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Invalid authentication token' });
  }

  const foundUser = await User.findById(payload._id).select('tokenVersion role');
  if (!foundUser || foundUser.tokenVersion !== payload.tokenVersion) {
    return res.status(401).json({ message: 'Session is no longer valid. Please log in again.' });
  }

  if (foundUser.role !== 'eventManager') {
    return res.status(403).json({ message: 'Access restricted to event managers' });
  }

  req.user = payload;
  return next();
};
