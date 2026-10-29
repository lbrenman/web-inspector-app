// Runs in every test file before any application module is loaded, so the config module
// picks up the test database.
const { getTestDatabaseUrl } = require('./helpers/testEnv');

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = getTestDatabaseUrl();
