'use strict';

const Message = require('../models/mongo/Message');

/**
 * Save a new message to MongoDB.
 */
async function saveMessage({ roomId, senderId, senderUsername, senderAvatar, content, type = 'text' }) {
  return Message.create({ roomId, senderId, senderUsername, senderAvatar, content, type });
}

/**
 * Get paginated message history for a room (cursor-based).
 * @param {string} roomId
 * @param {Object} options
 * @param {string} [options.before]  - ISO timestamp cursor (fetch messages older than this)
 * @param {number} [options.limit]   - messages per page (max 100)
 */
async function getRoomMessages(roomId, { before, limit = 50 } = {}) {
  const safeLimit = Math.min(Math.max(1, Number(limit) || 50), 100);
  const query = { roomId, deleted: false };

  if (before) {
    query.createdAt = { $lt: new Date(before) };
  }

  const messages = await Message.find(query)
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .lean();

  // Return oldest-first for the client
  return messages.reverse();
}

/**
 * Soft-edit a message (only allowed by the sender).
 */
async function editMessage(messageId, senderId, newContent) {
  const msg = await Message.findById(messageId);
  if (!msg) throw Object.assign(new Error('Message not found'), { status: 404 });
  if (msg.senderId !== senderId) throw Object.assign(new Error('Forbidden'), { status: 403 });
  if (msg.deleted) throw Object.assign(new Error('Cannot edit a deleted message'), { status: 400 });

  msg.content = newContent;
  msg.editedAt = new Date();
  await msg.save();
  return msg;
}

/**
 * Soft-delete a message (only allowed by the sender).
 */
async function deleteMessage(messageId, senderId) {
  const msg = await Message.findById(messageId);
  if (!msg) throw Object.assign(new Error('Message not found'), { status: 404 });
  if (msg.senderId !== senderId) throw Object.assign(new Error('Forbidden'), { status: 403 });

  msg.deleted = true;
  msg.content = '[Message deleted]';
  await msg.save();
  return msg;
}

module.exports = { saveMessage, getRoomMessages, editMessage, deleteMessage };
