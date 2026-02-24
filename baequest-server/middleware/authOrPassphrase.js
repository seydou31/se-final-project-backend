const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const SECRET = require('../utils/config');

// Allows event creation by either:
//   1. A logged-in user (valid JWT cookie), or
//   2. Anyone who provides the correct X-Event-Passphrase header
//      (given by you to trusted event managers — no account needed)
module.exports = (req, res, next) => {
  // Try JWT first (logged-in user)
  const token = req.cookies.jwt;
  if (token) {
    try {
      req.user = jwt.verify(token, SECRET.JWT_SECRET);
      return next();
    } catch {
      // Invalid/expired token — fall through to passphrase check
    }
  }

  // Try event manager passphrase (timing-safe comparison to prevent timing attacks)
  const passphrase = req.headers['x-event-passphrase'];
  const expected = process.env.EVENT_CREATION_PASSPHRASE;
  if (expected && passphrase) {
    const expectedBuf = Buffer.from(expected);
    const passphraseBuf = Buffer.from(passphrase);
    if (expectedBuf.length === passphraseBuf.length &&
        crypto.timingSafeEqual(expectedBuf, passphraseBuf)) {
      return next();
    }
  }

  return res.status(401).json({ message: 'Valid login or event manager passphrase required' });
};
