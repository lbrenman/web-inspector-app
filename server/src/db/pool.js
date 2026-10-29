const { Pool } = require('pg');
const config = require('../config');
const logger = require('../logger');

const pool = new Pool({ connectionString: config.databaseUrl });

// Without a listener, an error on an idle client would crash the process.
pool.on('error', (err) => {
  logger.error('Unexpected error on idle database client:', err.message);
});

module.exports = { pool };
