'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db.postgres');

const Room = sequelize.define('Room', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(80),
    allowNull: false,
    unique: true,
    validate: {
      len: [2, 80],
      is: /^[a-zA-Z0-9_\- ]+$/,
    },
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  isPrivate: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: false,
  },
}, {
  tableName: 'rooms',
  timestamps: true,
  indexes: [
    { fields: ['name'] },
    { fields: ['isPrivate'] },
  ],
});

module.exports = Room;
