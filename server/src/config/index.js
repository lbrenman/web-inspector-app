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

function parseInteger(name, fallback, { min = 1, max }) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Invalid ${name}: "${raw}" (expected an integer from ${min} to ${max})`);
  }
  return value;
}

function parseOptionalUrl(name) {
  const raw = process.env[name];
  if (!raw) return null;
  try {
    return new URL(raw).toString().replace(/\/+$/, '');
  } catch {
    throw new Error(`Invalid ${name}: "${raw}" is not a valid URL`);
  }
}

const env = process.env.NODE_ENV ?? 'development';
const capturePort = parseInteger('CAPTURE_PORT', 3001, { max: 65535 });
const apiPort = parseInteger('API_PORT', 3002, { max: 65535 });

if (capturePort === apiPort) {
  throw new Error('CAPTURE_PORT and API_PORT must be different');
}

module.exports = Object.freeze({
  env,
  isTest: env === 'test',
  host: process.env.HOST ?? '127.0.0.1',
  capturePort,
  apiPort,
  databaseUrl: requireEnv('DATABASE_URL'),
  maxBodyBytes: parseInteger('MAX_BODY_BYTES', 1024 * 1024, { max: 10 * 1024 * 1024 }),
  maxStoredRequests: parseInteger('MAX_STORED_REQUESTS', 1000, { max: 100000 }),
  capturePublicUrl: parseOptionalUrl('CAPTURE_PUBLIC_URL'),
});
