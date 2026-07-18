'use strict';

const { cleanEnv, str, port } = require('envalid');

const env = cleanEnv(process.env, {
  NODE_ENV: str({ choices: ['development', 'production', 'test'], default: 'development' }),
  PORT: port({ default: 3000 }),

  // PostgreSQL
  POSTGRES_USER:     str(),
  POSTGRES_PASSWORD: str(),
  POSTGRES_DB:       str(),
  POSTGRES_HOST:     str({ default: 'localhost' }),
  POSTGRES_PORT:     port({ default: 5432 }),

  // MongoDB — use MONGO_URI for native local installs (no auth).
  // If MONGO_URI is not set, it is built from the individual fields.
  MONGO_URI:      str({ default: '' }),
  MONGO_USER:     str({ default: '' }),
  MONGO_PASSWORD: str({ default: '' }),
  MONGO_DB:       str({ default: 'chatdb' }),
  MONGO_HOST:     str({ default: 'localhost' }),
  MONGO_PORT:     port({ default: 27017 }),

  // JWT
  JWT_SECRET:             str(),
  JWT_ACCESS_EXPIRES_IN:  str({ default: '15m' }),
  JWT_REFRESH_EXPIRES_IN: str({ default: '7d' }),

  // Google OAuth
  GOOGLE_CLIENT_ID:     str(),
  GOOGLE_CLIENT_SECRET: str(),

  // GitHub OAuth
  GITHUB_CLIENT_ID:     str(),
  GITHUB_CLIENT_SECRET: str(),

  // Frontend URL
  CLIENT_URL: str({ default: 'http://localhost:3000/demo' }),
});

module.exports = env;
