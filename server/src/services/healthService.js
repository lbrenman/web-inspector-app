const HttpError = require('../errors/HttpError');
const healthRepository = require('../db/healthRepository');
const logger = require('../logger');

async function check() {
  try {
    await healthRepository.ping();
  } catch (err) {
    logger.error('Health check failed:', err.message);
    throw new HttpError(503, 'SERVICE_UNAVAILABLE', 'Database unavailable');
  }
  return { status: 'ok', database: 'up' };
}

module.exports = { check };
