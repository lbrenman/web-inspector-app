const { z } = require('zod');

const INT4_MAX = 2147483647;

// Digits-only string -> number, so inputs like "1e3", "0x10" or "1.5" are rejected.
const digits = z.string().regex(/^\d+$/, 'Must be a non-negative integer');

const idParams = z.object({
  id: digits.transform(Number).pipe(z.number().int().min(1).max(INT4_MAX)),
});

const listQuery = z.object({
  limit: digits.transform(Number).pipe(z.number().int().min(1).max(200)).default('50'),
  before: digits.transform(Number).pipe(z.number().int().min(1).max(INT4_MAX)).optional(),
});

const hashParams = z.object({
  hash: z.string().regex(/^[0-9a-f]{40}$/, 'Must be a 40-character lowercase hex string'),
});

module.exports = { idParams, listQuery, hashParams };
