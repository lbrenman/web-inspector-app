const { pool } = require('./pool');

async function ping() {
  await pool.query('SELECT 1');
}

module.exports = { ping };
