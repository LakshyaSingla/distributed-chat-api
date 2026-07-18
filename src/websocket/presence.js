'use strict';

/**
 * In-memory presence store.
 *
 * Structure:
 *   presenceMap: Map<userId, { socketId, username, avatarUrl, status, lastSeen, rooms: Set<roomId> }>
 */
const presenceMap = new Map();

function setOnline(userId, userData) {
  presenceMap.set(userId, {
    ...userData,
    status: 'online',
    lastSeen: null,
    rooms: new Set(),
  });
}

function setOffline(userId) {
  const entry = presenceMap.get(userId);
  if (entry) {
    entry.status = 'offline';
    entry.lastSeen = new Date().toISOString();
  }
}

function addToRoom(userId, roomId) {
  const entry = presenceMap.get(userId);
  if (entry) entry.rooms.add(roomId);
}

function removeFromRoom(userId, roomId) {
  const entry = presenceMap.get(userId);
  if (entry) entry.rooms.delete(roomId);
}

function getPresence(userId) {
  return presenceMap.get(userId) || null;
}

function getOnlineUsersInRoom(roomId) {
  const result = [];
  for (const [userId, data] of presenceMap) {
    if (data.status === 'online' && data.rooms.has(roomId)) {
      result.push({ userId, username: data.username, avatarUrl: data.avatarUrl, status: 'online' });
    }
  }
  return result;
}

function getAllOnlineUsers() {
  const result = [];
  for (const [userId, data] of presenceMap) {
    if (data.status === 'online') {
      result.push({ userId, username: data.username, avatarUrl: data.avatarUrl, status: 'online' });
    }
  }
  return result;
}

module.exports = { setOnline, setOffline, addToRoom, removeFromRoom, getPresence, getOnlineUsersInRoom, getAllOnlineUsers };
