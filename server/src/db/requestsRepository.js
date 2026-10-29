const { pool } = require('./pool');

// Constant column lists (never user input), so interpolating them into SQL is safe.
const SUMMARY_COLUMNS = `id, received_at AS "receivedAt", method, path,
  query_string AS "queryString", content_type AS "contentType", body_size AS "bodySize",
  (body_json IS NOT NULL) AS "isJson", response_status AS "responseStatus"`;

const DETAIL_COLUMNS = `id, received_at AS "receivedAt", method, path,
  query_string AS "queryString", headers, remote_address AS "remoteAddress",
  http_version AS "httpVersion", content_type AS "contentType", body_raw AS "bodyRaw",
  body_size AS "bodySize", response_status AS "responseStatus",
  response_headers AS "responseHeaders", response_body AS "responseBody",
  response_rule AS "responseRule", response_delay_ms AS "responseDelayMs"`;

/** Reserves the id for the next request, so the reply (which may reference it) can be built first. */
async function nextId() {
  const { rows } = await pool.query(
    "SELECT nextval(pg_get_serial_sequence('requests', 'id'))::int AS id",
  );
  return rows[0].id;
}

async function insert(row) {
  const { rows } = await pool.query(
    `INSERT INTO requests
       (id, method, path, query_string, headers, remote_address, http_version, content_type,
        body_raw, body_size, body_json, shape_hash, shape_keys,
        response_status, response_headers, response_body, response_rule, response_delay_ms)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11::jsonb, $12, $13,
             $14, $15::jsonb, $16, $17, $18)
     RETURNING ${SUMMARY_COLUMNS}`,
    [
      row.id,
      row.method,
      row.path,
      row.queryString,
      row.headers,
      row.remoteAddress,
      row.httpVersion,
      row.contentType,
      row.bodyRaw,
      row.bodySize,
      row.bodyJson,
      row.shapeHash,
      row.shapeKeys,
      row.responseStatus,
      row.responseHeaders,
      row.responseBody,
      row.responseRule,
      row.responseDelayMs,
    ],
  );
  return rows[0];
}

/** Deletes everything older than the newest `max` rows. */
async function trimToLimit(max) {
  await pool.query(
    `DELETE FROM requests
     WHERE id <= (SELECT id FROM requests ORDER BY id DESC OFFSET $1 LIMIT 1)`,
    [max],
  );
}

async function list({ limit, before }) {
  const { rows } = await pool.query(
    `SELECT ${SUMMARY_COLUMNS} FROM requests
     WHERE ($1::int IS NULL OR id < $1::int)
     ORDER BY id DESC
     LIMIT $2`,
    [before, limit],
  );
  return rows;
}

async function findById(id) {
  const { rows } = await pool.query(`SELECT ${DETAIL_COLUMNS} FROM requests WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

async function deleteById(id) {
  const { rowCount } = await pool.query('DELETE FROM requests WHERE id = $1', [id]);
  return rowCount > 0;
}

async function deleteAll() {
  const { rowCount } = await pool.query('DELETE FROM requests');
  return rowCount;
}

/** Groups of JSON-object requests that share the same top-level keys (2+ requests). */
async function listShapeGroups() {
  const { rows } = await pool.query(
    `SELECT g.shape_hash AS "shapeHash", g.count, g.first_seen AS "firstSeen",
            g.last_seen AS "lastSeen", r.shape_keys AS "shapeKeys"
     FROM (
       SELECT shape_hash, count(*)::int AS count, min(received_at) AS first_seen,
              max(received_at) AS last_seen, max(id) AS latest_id
       FROM requests
       WHERE shape_hash IS NOT NULL
       GROUP BY shape_hash
       HAVING count(*) >= 2
     ) g
     JOIN requests r ON r.id = g.latest_id
     ORDER BY g.last_seen DESC, g.latest_id DESC`,
  );
  return rows;
}

async function findByShape(shapeHash, limit) {
  const { rows } = await pool.query(
    `SELECT id, received_at AS "receivedAt", body_json AS "bodyJson", shape_keys AS "shapeKeys",
            (count(*) OVER ())::int AS total
     FROM requests
     WHERE shape_hash = $1
     ORDER BY id DESC
     LIMIT $2`,
    [shapeHash, limit],
  );
  return rows;
}

module.exports = {
  nextId,
  insert,
  trimToLimit,
  list,
  findById,
  deleteById,
  deleteAll,
  listShapeGroups,
  findByShape,
};
