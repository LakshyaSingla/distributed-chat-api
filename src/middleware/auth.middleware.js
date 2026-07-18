'use strict';

const { verifyToken } = require('../auth/jwt.utils');
const { User } = require('../models/pg/index');

/**
 * Express middleware that validates a Bearer JWT.
 * Attaches `req.user` (PostgreSQL User instance) on success.
 */
async function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyToken(token);
    if (payload.type !== 'access') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    const user = await User.findByPk(payload.sub, {
      attributes: ['id', 'username', 'email', 'avatarUrl', 'provider'],
    });
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = authMiddleware;
