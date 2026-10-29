const { setTimeout: sleep } = require('node:timers/promises');
const captureService = require('../services/captureService');

/** Sends the reply exactly as it was recorded. Repeated header names are sent as multiple values. */
function sendReply(res, reply) {
  const grouped = new Map();
  for (const [name, value] of reply.headers) {
    const key = name.toLowerCase();
    if (!grouped.has(key)) grouped.set(key, { name, values: [] });
    grouped.get(key).values.push(value);
  }

  res.status(reply.status);
  for (const { name, values } of grouped.values()) {
    res.setHeader(name, values.length === 1 ? values[0] : values);
  }
  res.end(reply.body);
}

async function capture(req, res) {
  const { reply } = await captureService.record({
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
    rawHeaders: req.rawHeaders,
    httpVersion: req.httpVersion,
    remoteAddress: req.socket.remoteAddress,
    // express.raw leaves req.body undefined when the request has no body.
    body: Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0),
  });

  // The request is already stored and visible in the UI; only the caller waits.
  if (reply.delayMs > 0) {
    await sleep(reply.delayMs);
  }
  if (res.destroyed) return;

  sendReply(res, reply);
}

module.exports = { capture };
