'use strict';

const { Server } = require('socket.io');
const wsAuth = require('../middleware/ws.auth');
const presence = require('./presence');
const { registerHandlers } = require('./handlers');
const env = require('../config/env');

/**
 * Attach Socket.io to an existing HTTP server.
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server}
 */
function createGateway(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: env.CLIENT_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Ping settings for connection health
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  // ── Authentication middleware ────────────────────────────────────────────
  io.use(wsAuth);

  // ── Connection handler ───────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const user = socket.user;
    console.log(`🔌 WebSocket connected: ${user.username} (${socket.id})`);

    // Mark user online in presence store
    presence.setOnline(user.id, {
      socketId: socket.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
    });

    // Broadcast online status to everyone
    io.emit('presence_update', {
      userId: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      status: 'online',
    });

    // Register all event handlers
    registerHandlers(socket, io);

    // ── Disconnect ─────────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      console.log(`🔌 WebSocket disconnected: ${user.username} — ${reason}`);

      const presenceEntry = presence.getPresence(user.id);
      const rooms = presenceEntry ? [...presenceEntry.rooms] : [];

      presence.setOffline(user.id);

      // Notify all rooms this user was in
      rooms.forEach((roomId) => {
        io.to(roomId).emit('user_left', {
          roomId,
          userId: user.id,
          username: user.username,
        });
      });

      // Broadcast offline status
      io.emit('presence_update', {
        userId: user.id,
        username: user.username,
        status: 'offline',
        lastSeen: new Date().toISOString(),
      });
    });
  });

  console.log('🚀 WebSocket gateway initialized');
  return io;
}

module.exports = { createGateway };
