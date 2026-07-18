'use strict';

const { saveMessage, editMessage, deleteMessage } = require('../services/message.service');
const { joinRoom, leaveRoom, isMember } = require('../services/room.service');
const presence = require('./presence');

/**
 * Register all Socket.io event handlers for a connected socket.
 * @param {import('socket.io').Socket} socket
 * @param {import('socket.io').Server} io
 */
function registerHandlers(socket, io) {
  const user = socket.user; // Populated by ws.auth middleware

  // ── join_room ─────────────────────────────────────────────────────────────
  socket.on('join_room', async ({ roomId } = {}) => {
    if (!roomId) return socket.emit('error', { message: 'roomId is required' });

    try {
      // Auto-join in DB if not already a member
      await joinRoom(user.id, roomId);

      socket.join(roomId);
      presence.addToRoom(user.id, roomId);

      // Notify others in the room
      socket.to(roomId).emit('user_joined', {
        roomId,
        userId: user.id,
        username: user.username,
        avatarUrl: user.avatarUrl,
      });

      // Confirm to caller + send current online users
      socket.emit('room_joined', {
        roomId,
        onlineUsers: presence.getOnlineUsersInRoom(roomId),
      });
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // ── leave_room ────────────────────────────────────────────────────────────
  socket.on('leave_room', async ({ roomId } = {}) => {
    if (!roomId) return socket.emit('error', { message: 'roomId is required' });

    socket.leave(roomId);
    presence.removeFromRoom(user.id, roomId);

    socket.to(roomId).emit('user_left', {
      roomId,
      userId: user.id,
      username: user.username,
    });
  });

  // ── send_message ──────────────────────────────────────────────────────────
  socket.on('send_message', async ({ roomId, content, type = 'text' } = {}) => {
    if (!roomId || !content) {
      return socket.emit('error', { message: 'roomId and content are required' });
    }
    if (content.length > 4000) {
      return socket.emit('error', { message: 'Message too long (max 4000 chars)' });
    }

    try {
      // Verify membership before persisting
      const member = await isMember(user.id, roomId);
      if (!member) return socket.emit('error', { message: 'You are not a member of this room' });

      const message = await saveMessage({
        roomId,
        senderId: user.id,
        senderUsername: user.username,
        senderAvatar: user.avatarUrl,
        content: content.trim(),
        type,
      });

      // Broadcast to everyone in the room (including sender)
      io.to(roomId).emit('new_message', message.toObject());
    } catch (err) {
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // ── edit_message ──────────────────────────────────────────────────────────
  socket.on('edit_message', async ({ messageId, roomId, content } = {}) => {
    if (!messageId || !content) {
      return socket.emit('error', { message: 'messageId and content are required' });
    }

    try {
      const updated = await editMessage(messageId, user.id, content.trim());
      io.to(roomId).emit('message_edited', updated.toObject());
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // ── delete_message ────────────────────────────────────────────────────────
  socket.on('delete_message', async ({ messageId, roomId } = {}) => {
    if (!messageId) return socket.emit('error', { message: 'messageId is required' });

    try {
      const deleted = await deleteMessage(messageId, user.id);
      io.to(roomId).emit('message_deleted', { messageId, roomId, tombstone: deleted.toObject() });
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // ── typing_start ──────────────────────────────────────────────────────────
  socket.on('typing_start', ({ roomId } = {}) => {
    if (!roomId) return;
    socket.to(roomId).emit('user_typing', {
      roomId,
      userId: user.id,
      username: user.username,
      typing: true,
    });
  });

  // ── typing_stop ───────────────────────────────────────────────────────────
  socket.on('typing_stop', ({ roomId } = {}) => {
    if (!roomId) return;
    socket.to(roomId).emit('user_typing', {
      roomId,
      userId: user.id,
      username: user.username,
      typing: false,
    });
  });

  // ── ping / pong ───────────────────────────────────────────────────────────
  socket.on('ping', () => socket.emit('pong', { timestamp: Date.now() }));
}

module.exports = { registerHandlers };
