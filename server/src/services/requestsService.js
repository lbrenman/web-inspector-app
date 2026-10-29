const HttpError = require('../errors/HttpError');
const requestsRepository = require('../db/requestsRepository');
const requestEvents = require('../events/requestEvents');
const { analyzeBody } = require('../lib/body');
const { findHeader } = require('../lib/headers');
const { findTables } = require('../lib/tables');

function notFound() {
  return new HttpError(404, 'NOT_FOUND', 'Request not found');
}

async function listRequests({ limit, before }) {
  // Fetch one extra row to learn whether another page exists.
  const rows = await requestsRepository.list({ limit: limit + 1, before: before ?? null });
  const hasMore = rows.length > limit;
  return { items: hasMore ? rows.slice(0, limit) : rows, hasMore };
}

/** The reply that was sent, or null for requests captured before replies were recorded. */
function toResponse(row) {
  if (row.responseStatus === null) return null;

  const pairs = row.responseHeaders ?? [];
  const { encoding, size, text, base64, isJson } = analyzeBody(
    Buffer.from(row.responseBody ?? '', 'utf8'),
    findHeader(pairs, 'content-type') ?? null,
  );

  return {
    status: row.responseStatus,
    rule: row.responseRule,
    delayMs: row.responseDelayMs ?? 0,
    headers: pairs.map(([name, headerValue]) => ({ name, value: headerValue })),
    body: { encoding, size, text, base64, isJson },
  };
}

function toDetail(row) {
  const { value, ...body } = analyzeBody(row.bodyRaw, row.contentType);

  return {
    id: row.id,
    receivedAt: row.receivedAt,
    method: row.method,
    path: row.path,
    queryString: row.queryString,
    httpVersion: row.httpVersion,
    remoteAddress: row.remoteAddress,
    headers: row.headers.map(([name, headerValue]) => ({ name, value: headerValue })),
    query: [...new URLSearchParams(row.queryString)].map(([name, queryValue]) => ({
      name,
      value: queryValue,
    })),
    body,
    tables: body.isJson ? findTables(value) : [],
    response: toResponse(row),
  };
}

async function getRequest(id) {
  const row = await requestsRepository.findById(id);
  if (!row) throw notFound();
  return toDetail(row);
}

async function deleteRequest(id) {
  const deleted = await requestsRepository.deleteById(id);
  if (!deleted) throw notFound();
  requestEvents.publish('deleted', { id });
}

async function clearRequests() {
  const deleted = await requestsRepository.deleteAll();
  requestEvents.publish('cleared', {});
  return deleted;
}

module.exports = { listRequests, getRequest, deleteRequest, clearRequests };
