'use strict';

const bcrypt = require('bcryptjs');
const { signAccessToken, signRefreshToken, verifyToken } = require('../auth/jwt.utils');
const { RefreshToken, User } = require('../models/pg/index');
const env = require('../config/env');

const REFRESH_SALT_ROUNDS = 10;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Issue an access + refresh token pair for a user.
 * Persists a hashed refresh token to the DB.
 */
async function issueTokens(userId) {
  const accessToken = signAccessToken(userId);
  const refreshToken = signRefreshToken(userId);

  const hash = await bcrypt.hash(refreshToken, REFRESH_SALT_ROUNDS);
  await RefreshToken.create({
    userId,
    tokenHash: hash,
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  });

  return { accessToken, refreshToken };
}

/**
 * Rotate refresh token: validate old → revoke → issue new pair.
 */
async function rotateRefreshToken(rawRefreshToken) {
  let payload;
  try {
    payload = verifyToken(rawRefreshToken);
  } catch {
    throw Object.assign(new Error('Invalid or expired refresh token'), { status: 401 });
  }

  if (payload.type !== 'refresh') {
    throw Object.assign(new Error('Invalid token type'), { status: 401 });
  }

  // Find a valid, un-revoked token for this user
  const stored = await RefreshToken.findAll({
    where: { userId: payload.sub, revokedAt: null },
    order: [['createdAt', 'DESC']],
    limit: 10,
  });

  let matchedToken = null;
  for (const t of stored) {
    if (new Date() < t.expiresAt && (await bcrypt.compare(rawRefreshToken, t.tokenHash))) {
      matchedToken = t;
      break;
    }
  }

  if (!matchedToken) {
    // Possible token reuse attack — revoke ALL tokens for this user
    await RefreshToken.update({ revokedAt: new Date() }, { where: { userId: payload.sub, revokedAt: null } });
    throw Object.assign(new Error('Refresh token reuse detected — all sessions revoked'), { status: 401 });
  }

  // Revoke the used token
  await matchedToken.update({ revokedAt: new Date() });

  // Issue fresh pair
  return issueTokens(payload.sub);
}

/**
 * Revoke all refresh tokens for a user (logout).
 */
async function revokeAllTokens(userId) {
  await RefreshToken.update({ revokedAt: new Date() }, { where: { userId, revokedAt: null } });
}

/**
 * Clean up expired tokens (call periodically).
 */
async function purgeExpiredTokens() {
  const { Op } = require('sequelize');
  const deleted = await RefreshToken.destroy({
    where: { expiresAt: { [Op.lt]: new Date() } },
  });
  console.log(`🧹 Purged ${deleted} expired refresh tokens`);
}

module.exports = { issueTokens, rotateRefreshToken, revokeAllTokens, purgeExpiredTokens };
