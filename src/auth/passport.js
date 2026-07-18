'use strict';

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const env = require('../config/env');
const { User } = require('../models/pg/index');

/**
 * Upsert a user from an OAuth profile.
 *
 * Priority:
 *  1. Find by providerKey (same provider, returning user)          → update profile info
 *  2. Find by email (same person, different provider)              → link provider, update info
 *  3. Neither found → create a brand-new user
 *
 * This prevents the unique-constraint crash when the same email
 * is registered via both Google and GitHub.
 */
async function upsertUser(provider, profile) {
  const providerKey = `${provider}:${profile.id}`;
  const email = profile.emails?.[0]?.value || null;
  const avatarUrl =
    profile.photos?.[0]?.value ||
    profile._json?.avatar_url || // GitHub
    null;

  let username =
    profile.displayName ||
    profile.username ||
    profile._json?.login ||       // GitHub login
    email?.split('@')[0] ||
    'user';
  username = username.slice(0, 50);

  // 1️⃣ Already signed in with this exact provider before
  let user = await User.findOne({ where: { providerKey } });

  if (user) {
    // Refresh avatar / username in case they changed it upstream
    await user.update({ username, avatarUrl, email });
    return user;
  }

  // 2️⃣ Same email exists from a different provider → link it
  if (email) {
    user = await User.findOne({ where: { email } });
    if (user) {
      // Update to the current provider so next login is also fast
      await user.update({ providerKey, provider, providerId: String(profile.id), username, avatarUrl });
      return user;
    }
  }

  // 3️⃣ Brand-new user
  user = await User.create({
    providerKey,
    provider,
    providerId: String(profile.id),
    username,
    email,
    avatarUrl,
  });

  return user;
}

// ── Google Strategy ──────────────────────────────────────────────────────────
passport.use(
  new GoogleStrategy(
    {
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: 'http://localhost:' + env.PORT + '/auth/google/callback',
      scope: ['profile', 'email'],
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const user = await upsertUser('google', profile);
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

// ── GitHub Strategy ──────────────────────────────────────────────────────────
passport.use(
  new GitHubStrategy(
    {
      clientID: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      callbackURL: 'http://localhost:' + env.PORT + '/auth/github/callback',
      scope: ['user:email'],
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const user = await upsertUser('github', profile);
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

module.exports = passport;
