const { pool } = require('./pool');

// Constant column list (never user input), so interpolating it into SQL is safe.
const COLUMNS = 'id, title, body, created_at AS "createdAt", updated_at AS "updatedAt"';

async function list({ limit, offset }) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM notes ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return rows;
}

async function findById(id) {
  const { rows } = await pool.query(`SELECT ${COLUMNS} FROM notes WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

async function create({ title, body }) {
  const { rows } = await pool.query(
    `INSERT INTO notes (title, body) VALUES ($1, $2) RETURNING ${COLUMNS}`,
    [title, body],
  );
  return rows[0];
}

async function deleteById(id) {
  const { rowCount } = await pool.query('DELETE FROM notes WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = { list, findById, create, deleteById };
