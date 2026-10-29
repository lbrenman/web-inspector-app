const captureService = require('../services/captureService');

async function capture(req, res) {
  const { id } = await captureService.record({
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
    rawHeaders: req.rawHeaders,
    httpVersion: req.httpVersion,
    remoteAddress: req.socket.remoteAddress,
    // express.raw leaves req.body undefined when the request has no body.
    body: Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0),
  });

  res.status(200).json({ received: true, id });
}

module.exports = { capture };
