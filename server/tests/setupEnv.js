// Runs in every test file before any application module is loaded, so the config module
// picks up the test database and these deliberately small limits.
const { getTestDatabaseUrl } = require('./helpers/testEnv');

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = getTestDatabaseUrl();
process.env.MAX_BODY_BYTES = '4096';
process.env.MAX_STORED_REQUESTS = '50';
process.env.CAPTURE_PUBLIC_URL = 'https://capture.example.test/';
