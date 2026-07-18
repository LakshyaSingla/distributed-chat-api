'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/db.postgres');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: true,
    unique: true,
    validate: { isEmail: true },
  },
  avatarUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // OAuth provider: 'google' | 'github'
  provider: {
    type: DataTypes.ENUM('google', 'github'),
    allowNull: false,
  },
  // Unique ID from the OAuth provider
  providerId: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  // Concatenated for fast upsert lookups
  providerKey: {
    type: DataTypes.STRING(320),
    allowNull: false,
    unique: true,
  },
}, {
  tableName: 'users',
  timestamps: true,
  indexes: [
    { fields: ['providerKey'] },
    { fields: ['email'] },
  ],
});

module.exports = User;
