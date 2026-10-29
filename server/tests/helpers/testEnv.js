const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

/**
 * Returns the test database URL, refusing anything whose database name does not end
 * in "_test". The suite truncates every table, so this guards against pointing it at dev data.
 */
function getTestDatabaseUrl() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error('Missing required environment variable: TEST_DATABASE_URL');
  }

  const dbName = decodeURIComponent(new URL(url).pathname.slice(1));
  if (!/^[A-Za-z0-9_]+_test$/.test(dbName)) {
    throw new Error(
      `TEST_DATABASE_URL must point to a database whose name ends in "_test" (got "${dbName}")`,
    );
  }
  return url;
}

module.exports = { getTestDatabaseUrl };
