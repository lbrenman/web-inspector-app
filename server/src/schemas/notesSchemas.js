const { z } = require('zod');

const INT4_MAX = 2147483647;

// Digits-only string -> number, so inputs like "1e3", "0x10" or "1.5" are rejected.
const digits = z.string().regex(/^\d+$/, 'Must be a non-negative integer');

const idParams = z.object({
  id: digits.transform(Number).pipe(z.number().int().min(1).max(INT4_MAX)),
});

const listQuery = z.object({
  limit: digits.transform(Number).pipe(z.number().int().min(1).max(100)).default('50'),
  offset: digits.transform(Number).pipe(z.number().int().max(1_000_000)).default('0'),
});

const createBody = z
  .object({
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(10_000),
  })
  .strict();

module.exports = { idParams, listQuery, createBody };
