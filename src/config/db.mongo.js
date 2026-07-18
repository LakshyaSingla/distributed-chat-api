'use strict';

const mongoose = require('mongoose');
const env = require('./env');

// For native local installs: use MONGO_URI directly (no auth needed).
// For Docker installs: URI is built from individual fields with auth.
function buildMongoUri() {
  if (env.MONGO_URI) return env.MONGO_URI;
  if (env.MONGO_USER && env.MONGO_PASSWORD) {
    return `mongodb://${env.MONGO_USER}:${env.MONGO_PASSWORD}@${env.MONGO_HOST}:${env.MONGO_PORT}/${env.MONGO_DB}?authSource=admin`;
  }
  // No auth — local native install default
  return `mongodb://${env.MONGO_HOST}:${env.MONGO_PORT}/${env.MONGO_DB}`;
}

const MONGO_URI = buildMongoUri();

async function connectMongo() {
  await mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
  });
  console.log('✅ MongoDB connected');
}

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB disconnected');
});

module.exports = { connectMongo };
