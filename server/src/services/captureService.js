const config = require('../config');
const requestsRepository = require('../db/requestsRepository');
const requestEvents = require('../events/requestEvents');
const { analyzeBody } = require('../lib/body');
const { findHeader, pairHeaders } = require('../lib/headers');
const { computeShape } = require('../lib/shape');

/** jsonb rejects some values JSON.parse accepts (e.g. lone surrogates); fall back to raw-only. */
async function insertWithFallback(row) {
  try {
    return await requestsRepository.insert(row);
  } catch (err) {
    const isDataError = typeof err.code === 'string' && err.code.startsWith('22');
    if (row.bodyJson !== null && isDataError) {
      return requestsRepository.insert({ ...row, bodyJson: null, shapeHash: null, shapeKeys: null });
    }
    throw err;
  }
}

function toJsonbParams(analysis) {
  if (!analysis.isJson) return { bodyJson: null, shape: null };
  try {
    const serialized = JSON.stringify(analysis.value);
    // jsonb cannot hold NUL characters.
    if (serialized === undefined || serialized.includes('\\u0000')) {
      return { bodyJson: null, shape: null };
    }
    return { bodyJson: serialized, shape: computeShape(analysis.value) };
  } catch {
    return { bodyJson: null, shape: null };
  }
}

/** Persists one captured HTTP request and notifies live subscribers. */
async function record({ method, path, originalUrl, rawHeaders, httpVersion, remoteAddress, body }) {
  const headers = pairHeaders(rawHeaders);
  const contentType = findHeader(headers, 'content-type') ?? null;
  const { bodyJson, shape } = toJsonbParams(analyzeBody(body, contentType));

  const queryStart = originalUrl.indexOf('?');

  const summary = await insertWithFallback({
    method,
    path,
    queryString: queryStart === -1 ? '' : originalUrl.slice(queryStart + 1),
    headers: JSON.stringify(headers),
    remoteAddress: remoteAddress ?? null,
    httpVersion,
    contentType,
    bodyRaw: body,
    bodySize: body.length,
    bodyJson,
    shapeHash: shape?.hash ?? null,
    shapeKeys: shape?.keys ?? null,
  });

  await requestsRepository.trimToLimit(config.maxStoredRequests);
  requestEvents.publish('request', summary);
  return summary;
}

module.exports = { record };
