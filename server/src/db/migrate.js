const path = require('node:path');
const { runner } = require('node-pg-migrate');

const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

async function runMigrations({ databaseUrl, direction = 'up', count, log = () => {} }) {
  return runner({
    databaseUrl,
    dir: MIGRATIONS_DIR,
    direction,
    count: count ?? (direction === 'up' ? Infinity : 1),
    migrationsTable: 'pgmigrations',
    logger: { debug: () => {}, info: log, warn: log, error: log },
  });
}

module.exports = { runMigrations };
