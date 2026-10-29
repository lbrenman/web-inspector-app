const { pool } = require('../../src/db/pool');

async function assertTestDatabase() {
  const { rows } = await pool.query('SELECT current_database() AS name');
  if (!rows[0].name.endsWith('_test')) {
    throw new Error(`Refusing to truncate non-test database "${rows[0].name}"`);
  }
}

/** Empties every table in the public schema (except the migrations table) and resets ids. */
async function truncateAll() {
  await assertTestDatabase();

  const { rows } = await pool.query(
    `SELECT tablename FROM pg_tables
     WHERE schemaname = 'public' AND tablename <> 'pgmigrations'`,
  );
  if (rows.length === 0) return;

  const tables = rows.map((r) => `"${r.tablename.replace(/"/g, '""')}"`).join(', ');
  await pool.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
}

module.exports = { truncateAll };
