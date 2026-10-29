const HttpError = require('../errors/HttpError');
const requestsRepository = require('../db/requestsRepository');
const requestEvents = require('../events/requestEvents');
const { analyzeBody } = require('../lib/body');
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
