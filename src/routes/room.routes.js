'use strict';

const express = require('express');
const Joi = require('joi');
const authMiddleware = require('../middleware/auth.middleware');
const { listRooms, createRoom, getRoomById, joinRoom, leaveRoom } = require('../services/room.service');

const router = express.Router();

const createRoomSchema = Joi.object({
  name: Joi.string().min(2).max(80).pattern(/^[a-zA-Z0-9_\- ]+$/).required(),
  description: Joi.string().max(500).optional().allow(''),
  isPrivate: Joi.boolean().default(false),
});

// GET /rooms — list all visible rooms
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const rooms = await listRooms(req.user.id);
    return res.json(rooms);
  } catch (err) {
    next(err);
  }
});

// POST /rooms — create a room
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { error, value } = createRoomSchema.validate(req.body);
    if (error) return next(error);

    const room = await createRoom(req.user.id, value);
    return res.status(201).json(room);
  } catch (err) {
    next(err);
  }
});

// GET /rooms/:id — room detail + members
router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    const room = await getRoomById(req.params.id);
    return res.json(room);
  } catch (err) {
    next(err);
  }
});

// POST /rooms/:id/join
router.post('/:id/join', authMiddleware, async (req, res, next) => {
  try {
    const result = await joinRoom(req.user.id, req.params.id);
    if (result.alreadyMember) {
      return res.json({ message: 'Already a member' });
    }
    return res.status(201).json({ message: 'Joined room', member: result.member });
  } catch (err) {
    next(err);
  }
});

// POST /rooms/:id/leave
router.post('/:id/leave', authMiddleware, async (req, res, next) => {
  try {
    await leaveRoom(req.user.id, req.params.id);
    return res.json({ message: 'Left room' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
