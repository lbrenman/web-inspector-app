const { runMigrations } = require('../src/db/migrate');

async function main() {
  const direction = process.argv[2] ?? 'up';
  if (!['up', 'down'].includes(direction)) {
    throw new Error('Usage: node scripts/migrate.js [up|down]');
  }

  // Required here so a missing env var surfaces as a clean error message below.
  const config = require('../src/config');
  await runMigrations({ databaseUrl: config.databaseUrl, direction, log: console.log });
}

main().catch((err) => {
  console.error(`Migration failed: ${err.message}`);
  process.exitCode = 1;
});
