const HttpError = require('../errors/HttpError');
const logger = require('../logger');

// Express identifies error middleware by its 4-argument signature, so `next` must stay.
function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof HttpError) {
    const error = { code: err.code, message: err.message };
    if (err.details !== undefined) {
      error.details = err.details;
    }
    return res.status(err.status).json({ error });
  }

  // body-parser errors (http-errors instances carrying a `type`).
  if (err?.type === 'entity.parse.failed') {
    return res
      .status(400)
      .json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } });
  }
  if (err?.type === 'entity.too.large') {
    return res
      .status(413)
      .json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' } });
  }

  // Other client errors raised by Express/body-parser (unsupported encoding, aborted request, ...).
  if (Number.isInteger(err?.status) && err.status >= 400 && err.status < 500 && err.expose) {
    return res.status(err.status).json({ error: { code: 'BAD_REQUEST', message: err.message } });
  }

  // Anything else is unexpected: log internally, never leak details to the client.
  logger.error(`Unhandled error on ${req.method} ${req.originalUrl}:`, err);
  return res
    .status(500)
    .json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
}

module.exports = errorHandler;
