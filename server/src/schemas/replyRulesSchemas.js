const { z } = require('zod');

const INT4_MAX = 2147483647;

// '*', an exact path under /hook, or a /hook prefix ending in a single '*'.
const PATH_PATTERN = /^(?:\*|\/hook[^\s*]*\*?)$/;

// RFC 9110 token characters.
const HEADER_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
// Node rejects header values outside tab, printable ASCII and Latin-1.
const HEADER_VALUE = /^[\t\x20-\x7e\x80-\xff]*$/;

// Framing and connection headers are managed by the server.
const MANAGED_HEADERS = new Set([
  'content-length',
  'transfer-encoding',
  'connection',
  'keep-alive',
  'upgrade',
  'te',
  'trailer',
  'proxy-authenticate',
  'proxy-authorization',
  'proxy-connection',
]);

const headerSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .max(100)
      .regex(HEADER_NAME, 'Invalid header name')
      .refine((name) => !MANAGED_HEADERS.has(name.toLowerCase()), 'This header is set by the server'),
    value: z.string().max(8192).regex(HEADER_VALUE, 'Invalid characters in header value'),
  })
  .strict();

const ruleBody = z
  .object({
    name: z.string().trim().min(1).max(100),
    pathPattern: z
      .string()
      .trim()
      .max(500)
      .regex(PATH_PATTERN, 'Use "*", a path starting with /hook, or a /hook prefix ending in *'),
    status: z.number().int().min(200).max(599),
    headers: z.array(headerSchema).max(30).default([]),
    body: z
      .string()
      .max(65536)
      .refine((text) => !text.includes('\u0000'), 'Must not contain NUL characters')
      .default(''),
    delayMs: z.number().int().min(0).max(10000).default(0),
  })
  .strict();

const idParams = z.object({
  id: z
    .string()
    .regex(/^\d+$/, 'Must be a non-negative integer')
    .transform(Number)
    .pipe(z.number().int().min(1).max(INT4_MAX)),
});

module.exports = { ruleBody, idParams };
