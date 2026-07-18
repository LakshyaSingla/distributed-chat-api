'use strict';

const express = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const { getUserById } = require('../services/user.service');

const router = express.Router();

// GET /users/me — current authenticated user
router.get('/me', authMiddleware, (req, res) => {
  return res.json(req.user);
});

// GET /users/:id — public profile
router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    const user = await getUserById(req.params.id);
    return res.json(user);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
