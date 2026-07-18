'use strict';

/**
 * Centralized Express error handler.
 * Must be registered LAST: app.use(errorHandler)
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  // Joi validation errors
  if (err.isJoi || err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation error',
      details: err.details?.map((d) => d.message) || [err.message],
    });
  }

  // Sequelize unique constraint
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ error: 'Resource already exists', field: err.errors?.[0]?.path });
  }

  // Sequelize validation
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      error: 'Database validation error',
      details: err.errors?.map((e) => e.message),
    });
  }

  // JWT errors (shouldn't reach here normally — caught in middleware)
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Authentication failed' });
  }

  // Generic / unhandled
  const status = err.status || err.statusCode || 500;
  const message = status < 500 ? err.message : 'Internal server error';

  if (status >= 500) {
    console.error('💥 Unhandled error:', err);
  }

  return res.status(status).json({ error: message });
}

module.exports = errorHandler;
