'use strict';

const { Room, RoomMember, User } = require('../models/pg/index');
const { Op } = require('sequelize');

/**
 * List rooms visible to a user (all public + rooms they are a member of).
 */
async function listRooms(userId) {
  // Public rooms
  const publicRooms = await Room.findAll({
    where: { isPrivate: false },
    include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'avatarUrl'] }],
    order: [['createdAt', 'DESC']],
  });

  // Private rooms where user is a member
  const privateRooms = await Room.findAll({
    where: { isPrivate: true },
    include: [
      { model: User, as: 'creator', attributes: ['id', 'username', 'avatarUrl'] },
      { model: RoomMember, as: 'memberships', where: { userId }, required: true },
    ],
    order: [['createdAt', 'DESC']],
  });

  return [...publicRooms, ...privateRooms];
}

/**
 * Create a new room. Creator auto-joins as admin.
 */
async function createRoom(userId, { name, description, isPrivate }) {
  const room = await Room.create({ name, description, isPrivate, createdBy: userId });
  await RoomMember.create({ userId, roomId: room.id, role: 'admin' });
  return room;
}

/**
 * Get room details with full member list.
 */
async function getRoomById(roomId) {
  const room = await Room.findByPk(roomId, {
    include: [
      { model: User, as: 'creator', attributes: ['id', 'username', 'avatarUrl'] },
      {
        model: RoomMember,
        as: 'memberships',
        include: [{ model: User, as: 'user', attributes: ['id', 'username', 'avatarUrl'] }],
      },
    ],
  });
  if (!room) throw Object.assign(new Error('Room not found'), { status: 404 });
  return room;
}

/**
 * Add user to a room.
 */
async function joinRoom(userId, roomId) {
  const room = await Room.findByPk(roomId);
  if (!room) throw Object.assign(new Error('Room not found'), { status: 404 });

  const [member, created] = await RoomMember.findOrCreate({
    where: { userId, roomId },
    defaults: { role: 'member' },
  });

  return { member, alreadyMember: !created };
}

/**
 * Remove user from a room.
 */
async function leaveRoom(userId, roomId) {
  const deleted = await RoomMember.destroy({ where: { userId, roomId } });
  if (!deleted) throw Object.assign(new Error('You are not a member of this room'), { status: 400 });
}

/**
 * Check if a user is a member of a room.
 */
async function isMember(userId, roomId) {
  const membership = await RoomMember.findOne({ where: { userId, roomId } });
  return membership !== null;
}

module.exports = { listRooms, createRoom, getRoomById, joinRoom, leaveRoom, isMember };
