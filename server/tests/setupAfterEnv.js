const { pool } = require('../src/db/pool');
const { truncateAll } = require('./helpers/db');

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await pool.end();
});
