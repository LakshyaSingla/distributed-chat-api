'use strict';

const { User } = require('../models/pg/index');

/**
 * Get a user's public profile by ID.
 */
async function getUserById(userId) {
  const user = await User.findByPk(userId, {
    attributes: ['id', 'username', 'email', 'avatarUrl', 'provider', 'createdAt'],
  });
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  return user;
}

/**
 * List all users (admin utility).
 */
async function listUsers({ limit = 50, offset = 0 } = {}) {
  return User.findAndCountAll({
    attributes: ['id', 'username', 'email', 'avatarUrl', 'provider', 'createdAt'],
    limit,
    offset,
    order: [['createdAt', 'DESC']],
  });
}

module.exports = { getUserById, listUsers };
