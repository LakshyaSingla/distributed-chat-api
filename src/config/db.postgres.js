'use strict';

const { Sequelize } = require('sequelize');
const env = require('./env');

const sequelize = new Sequelize(
  env.POSTGRES_DB,
  env.POSTGRES_USER,
  env.POSTGRES_PASSWORD,
  {
    host: env.POSTGRES_HOST,
    port: env.POSTGRES_PORT,
    dialect: 'postgres',
    logging: env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 10,
      min: 2,
      acquire: 30000,
      idle: 10000,
    },
  }
);

async function connectPostgres() {
  await sequelize.authenticate();
  console.log('✅ PostgreSQL connected');
  // Sync models (alter:true is safe for dev; use migrations in prod)
  await sequelize.sync({ alter: env.NODE_ENV === 'development' });
  console.log('✅ PostgreSQL models synced');
}

module.exports = { sequelize, connectPostgres };
