'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db.postgres');

const RoomMember = sequelize.define('RoomMember', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  roomId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('admin', 'member'),
    defaultValue: 'member',
    allowNull: false,
  },
}, {
  tableName: 'room_members',
  timestamps: true,
  createdAt: 'joinedAt',
  updatedAt: false,
  indexes: [
    { unique: true, fields: ['userId', 'roomId'] },
    { fields: ['roomId'] },
  ],
});

module.exports = RoomMember;
