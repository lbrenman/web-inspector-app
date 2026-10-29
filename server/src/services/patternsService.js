const HttpError = require('../errors/HttpError');
const requestsRepository = require('../db/requestsRepository');
const { buildTable } = require('../lib/tables');

const MAX_PATTERN_ROWS = 200;

async function listPatterns() {
  const groups = await requestsRepository.listShapeGroups();
  return groups.map((group) => ({
    id: group.shapeHash,
    count: group.count,
    firstSeen: group.firstSeen,
    lastSeen: group.lastSeen,
    keys: group.shapeKeys,
  }));
}

/** One row per request in the group (newest first), columns from the flattened JSON bodies. */
async function getPatternTable(hash) {
  const rows = await requestsRepository.findByShape(hash, MAX_PATTERN_ROWS);
  if (rows.length === 0) {
    throw new HttpError(404, 'NOT_FOUND', 'Pattern not found');
  }

  const keys = rows[0].shapeKeys;
  const {
    columns,
    rows: tableRows,
    columnsTruncated,
  } = buildTable(
    rows.map((row) => row.bodyJson),
    { keyOrder: keys },
  );

  return {
    id: hash,
    keys,
    columns,
    columnsTruncated,
    rows: tableRows,
    rowMeta: rows.map((row) => ({ id: row.id, receivedAt: row.receivedAt })),
    totalRows: rows[0].total,
  };
}

module.exports = { listPatterns, getPatternTable };
