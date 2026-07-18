'use strict';

const User = require('./User');
const Room = require('./Room');
const RoomMember = require('./RoomMember');
const RefreshToken = require('./RefreshToken');

// ── Associations ────────────────────────────────────────────────────────────

// A user creates many rooms
User.hasMany(Room, { foreignKey: 'createdBy', as: 'createdRooms' });
Room.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

// Many-to-many: Users ↔ Rooms via RoomMember
User.belongsToMany(Room, { through: RoomMember, foreignKey: 'userId', as: 'rooms' });
Room.belongsToMany(User, { through: RoomMember, foreignKey: 'roomId', as: 'members' });

// Direct has-many for convenience
User.hasMany(RoomMember, { foreignKey: 'userId', as: 'memberships' });
RoomMember.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Room.hasMany(RoomMember, { foreignKey: 'roomId', as: 'memberships' });
RoomMember.belongsTo(Room, { foreignKey: 'roomId', as: 'room' });

// Refresh tokens
User.hasMany(RefreshToken, { foreignKey: 'userId', as: 'refreshTokens' });
RefreshToken.belongsTo(User, { foreignKey: 'userId', as: 'user' });

module.exports = { User, Room, RoomMember, RefreshToken };
