'use strict';

const { verifyToken } = require('../auth/jwt.utils');
const { User } = require('../models/pg/index');

/**
 * Socket.io middleware that validates the JWT passed during handshake.
 * Usage in gateway: io.use(wsAuth)
 *
 * Client connects with: socket = io(URL, { auth: { token: '<jwt>' } })
 */
async function wsAuth(socket, next) {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');

  if (!token) {
    return next(new Error('Authentication required: no token provided'));
  }

  try {
    const payload = verifyToken(token);
    if (payload.type !== 'access') {
      return next(new Error('Invalid token type'));
    }

    const user = await User.findByPk(payload.sub, {
      attributes: ['id', 'username', 'email', 'avatarUrl'],
    });
    if (!user) {
      return next(new Error('User not found'));
    }

    // Attach user to socket for use in event handlers
    socket.user = user.toJSON();
    next();
  } catch (err) {
    return next(new Error(err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token'));
  }
}

module.exports = wsAuth;
