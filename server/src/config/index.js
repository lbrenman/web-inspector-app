const path = require('node:path');
const dotenv = require('dotenv');

// Repo-root .env. Variables already present in the environment always win (CI, tests).
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parsePort(raw) {
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: "${raw}"`);
  }
  return port;
}

const env = process.env.NODE_ENV ?? 'development';

module.exports = Object.freeze({
  env,
  isTest: env === 'test',
  host: process.env.HOST ?? '127.0.0.1',
  port: parsePort(process.env.PORT ?? '3001'),
  databaseUrl: requireEnv('DATABASE_URL'),
});
