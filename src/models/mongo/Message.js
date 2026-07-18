'use strict';

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    roomId: {
      type: String, // UUID from PostgreSQL
      required: true,
      index: true,
    },
    senderId: {
      type: String, // UUID from PostgreSQL
      required: true,
      index: true,
    },
    // Denormalized for fast reads without a join
    senderUsername: {
      type: String,
      required: true,
    },
    senderAvatar: {
      type: String,
      default: null,
    },
    content: {
      type: String,
      required: true,
      maxlength: 4000,
    },
    type: {
      type: String,
      enum: ['text', 'image', 'system'],
      default: 'text',
    },
    editedAt: {
      type: Date,
      default: null,
    },
    deleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true, // adds createdAt, updatedAt
    collection: 'messages',
  }
);

// Compound index for efficient room history pagination (cursor-based)
messageSchema.index({ roomId: 1, createdAt: -1 });

const Message = mongoose.model('Message', messageSchema);
module.exports = Message;
