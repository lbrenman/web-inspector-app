const { pool } = require('./pool');

// Constant column list (never user input), so interpolating it into SQL is safe.
const COLUMNS = `id, name, path_pattern AS "pathPattern", status, headers, body,
  delay_ms AS "delayMs"`;

async function list() {
  const { rows } = await pool.query(`SELECT ${COLUMNS} FROM reply_rules ORDER BY id`);
  return rows;
}

async function create(rule) {
  const { rows } = await pool.query(
    `INSERT INTO reply_rules (name, path_pattern, status, headers, body, delay_ms)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6)
     RETURNING ${COLUMNS}`,
    [rule.name, rule.pathPattern, rule.status, JSON.stringify(rule.headers), rule.body, rule.delayMs],
  );
  return rows[0];
}

async function update(id, rule) {
  const { rows } = await pool.query(
    `UPDATE reply_rules
     SET name = $2, path_pattern = $3, status = $4, headers = $5::jsonb, body = $6,
         delay_ms = $7, updated_at = now()
     WHERE id = $1
     RETURNING ${COLUMNS}`,
    [id, rule.name, rule.pathPattern, rule.status, JSON.stringify(rule.headers), rule.body, rule.delayMs],
  );
  return rows[0] ?? null;
}

async function deleteById(id) {
  const { rowCount } = await pool.query('DELETE FROM reply_rules WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = { list, create, update, deleteById };
