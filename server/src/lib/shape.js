const { createHash } = require('node:crypto');

const MAX_KEYS = 200;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * The "shape" of a JSON-object payload is its set of top-level keys (order-independent).
 * Returns { hash, keys } or null when the value is not an object worth grouping.
 * `keys` keeps the payload's own key order (used to order table columns).
 */
function computeShape(value) {
  if (!isPlainObject(value)) return null;

  const keys = Object.keys(value);
  if (keys.length === 0 || keys.length > MAX_KEYS) return null;

  const hash = createHash('sha1')
    .update(JSON.stringify([...keys].sort()))
    .digest('hex');
  return { hash, keys };
}

module.exports = { computeShape, isPlainObject };
