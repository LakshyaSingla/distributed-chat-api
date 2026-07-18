'use strict';

require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

// ── Env validation (throws on missing vars) ──────────────────────────────────
const env = require('./config/env');

// ── DB connections ───────────────────────────────────────────────────────────
const { connectPostgres } = require('./config/db.postgres');
const { connectMongo } = require('./config/db.mongo');

// ── Models (registers Sequelize associations) ────────────────────────────────
require('./models/pg/index');

// ── Express App ──────────────────────────────────────────────────────────────
const app = express();

app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));

// ── Static demo UI ───────────────────────────────────────────────────────────
app.use('/demo', express.static(path.join(__dirname, '..', 'demo')));

// ── Routes ───────────────────────────────────────────────────────────────────
const { apiLimiter } = require('./middleware/rate.limiter');
app.use('/auth', require('./routes/auth.routes'));
app.use('/api', apiLimiter);
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/rooms', require('./routes/room.routes'));
app.use('/api/rooms/:id/messages', require('./routes/message.routes'));

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Root redirect to demo
app.get('/', (_req, res) => res.redirect('/demo'));

// ── Error handler (must be last) ─────────────────────────────────────────────
app.use(require('./middleware/error.handler'));

// ── HTTP Server ───────────────────────────────────────────────────────────────
const httpServer = http.createServer(app);

// ── WebSocket Gateway ─────────────────────────────────────────────────────────
const { createGateway } = require('./websocket/gateway');
createGateway(httpServer);

// ── Start ─────────────────────────────────────────────────────────────────────
async function start() {
  try {
    await connectPostgres();
    await connectMongo();

    httpServer.listen(env.PORT, () => {
      console.log(`\n🚀 Server running at http://localhost:${env.PORT}`);
      console.log(`🎮 Demo UI:          http://localhost:${env.PORT}/demo`);
      console.log(`❤️  Health check:    http://localhost:${env.PORT}/health\n`);
    });
  } catch (err) {
    console.error('💥 Failed to start server:', err);
    process.exit(1);
  }
}

start();

module.exports = { app, httpServer };
