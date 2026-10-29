const HttpError = require('../errors/HttpError');

function notFound(_req, _res, next) {
  next(new HttpError(404, 'NOT_FOUND', 'Route not found'));
}

module.exports = notFound;
