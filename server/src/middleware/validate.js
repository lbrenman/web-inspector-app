const HttpError = require('../errors/HttpError');

const LOCATIONS = ['params', 'query', 'body'];

/**
 * Validates request parts against zod schemas: validate({ params, query, body }).
 * Parsed (coerced, defaulted, trimmed) values are exposed as `req.validated.<part>`;
 * `req.query` is a read-only getter in Express 5, so it cannot be overwritten in place.
 */
function validate(schemas) {
  return (req, _res, next) => {
    const validated = {};
    const issues = [];

    for (const location of LOCATIONS) {
      const schema = schemas[location];
      if (!schema) continue;

      const result = schema.safeParse(req[location] ?? {});
      if (result.success) {
        validated[location] = result.data;
      } else {
        for (const issue of result.error.issues) {
          issues.push({ location, path: issue.path.join('.'), message: issue.message });
        }
      }
    }

    if (issues.length > 0) {
      return next(new HttpError(400, 'VALIDATION_ERROR', 'Request validation failed', issues));
    }

    req.validated = validated;
    return next();
  };
}

module.exports = validate;
