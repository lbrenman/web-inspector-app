const { Client } = require('pg');
const { getTestDatabaseUrl } = require('./helpers/testEnv');
const { runMigrations } = require('../src/db/migrate');

// Runs once before the whole suite: create the test database if needed, then migrate it.
module.exports = async () => {
  const url = getTestDatabaseUrl();
  const dbName = decodeURIComponent(new URL(url).pathname.slice(1));

  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';

  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      dbName,
    ]);
    if (rowCount === 0) {
      // dbName is validated against /^[A-Za-z0-9_]+_test$/ in getTestDatabaseUrl().
      await admin.query(`CREATE DATABASE "${dbName}"`);
    }
  } finally {
    await admin.end();
  }

  await runMigrations({ databaseUrl: url, direction: 'up' });
};
