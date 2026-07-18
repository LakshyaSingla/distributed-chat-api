'use strict';

const express = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const { getRoomMessages } = require('../services/message.service');
const { isMember } = require('../services/room.service');

const router = express.Router({ mergeParams: true });

// GET /rooms/:id/messages?before=<ISO>&limit=<n>
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const { id: roomId } = req.params;
    const { before, limit } = req.query;

    // Check that the requester is a member (or room is public — service handles this)
    const member = await isMember(req.user.id, roomId);
    if (!member) {
      return res.status(403).json({ error: 'You are not a member of this room' });
    }

    const messages = await getRoomMessages(roomId, { before, limit });
    return res.json({
      messages,
      cursor: messages[0]?.createdAt?.toISOString() || null,
      hasMore: messages.length === (Number(limit) || 50),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
