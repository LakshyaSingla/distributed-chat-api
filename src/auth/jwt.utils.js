'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Sign a short-lived access token (15m by default).
 * @param {string} userId - PostgreSQL User UUID
 * @returns {string} signed JWT
 */
function signAccessToken(userId) {
  return jwt.sign({ sub: userId, type: 'access' }, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  });
}

/**
 * Sign a long-lived refresh token (7d by default).
 * The raw value is stored client-side; only its hash is kept in DB.
 * @param {string} userId
 * @returns {string} signed JWT
 */
function signRefreshToken(userId) {
  return jwt.sign({ sub: userId, type: 'refresh' }, env.JWT_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  });
}

/**
 * Verify any JWT token.
 * @param {string} token
 * @returns {{ sub: string, type: string, iat: number, exp: number }}
 * @throws {JsonWebTokenError | TokenExpiredError}
 */
function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

module.exports = { signAccessToken, signRefreshToken, verifyToken };
