'use strict';

const express = require('express');
const passport = require('../auth/passport');
const { issueTokens, rotateRefreshToken, revokeAllTokens } = require('../services/auth.service');
const authMiddleware = require('../middleware/auth.middleware');
const { authLimiter } = require('../middleware/rate.limiter');
const env = require('../config/env');

const router = express.Router();

// ── Google OAuth ──────────────────────────────────────────────────────────────
router.get('/google', authLimiter, passport.authenticate('google', { session: false }));

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/demo?error=auth_failed' }),
  async (req, res, next) => {
    try {
      const { accessToken, refreshToken } = await issueTokens(req.user.id);
      // Redirect to demo UI with tokens in URL fragment (never sent to server)
      return res.redirect(
        `${env.CLIENT_URL}#access=${accessToken}&refresh=${refreshToken}`
      );
    } catch (err) {
      next(err);
    }
  }
);

// ── GitHub OAuth ──────────────────────────────────────────────────────────────
router.get('/github', authLimiter, passport.authenticate('github', { session: false }));

router.get(
  '/github/callback',
  passport.authenticate('github', { session: false, failureRedirect: '/demo?error=auth_failed' }),
  async (req, res, next) => {
    try {
      const { accessToken, refreshToken } = await issueTokens(req.user.id);
      return res.redirect(
        `${env.CLIENT_URL}#access=${accessToken}&refresh=${refreshToken}`
      );
    } catch (err) {
      next(err);
    }
  }
);

// ── Token Refresh ─────────────────────────────────────────────────────────────
router.post('/refresh', authLimiter, async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken is required' });

    const tokens = await rotateRefreshToken(refreshToken);
    return res.json(tokens);
  } catch (err) {
    next(err);
  }
});

// ── Logout ────────────────────────────────────────────────────────────────────
router.post('/logout', authMiddleware, async (req, res, next) => {
  try {
    await revokeAllTokens(req.user.id);
    return res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
