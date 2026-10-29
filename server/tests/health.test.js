const request = require('supertest');
const { createApp } = require('../src/app');
const { pool } = require('../src/db/pool');

const app = createApp();

describe('GET /api/health', () => {
  it('reports ok when the database is reachable', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', database: 'up' });
  });

  it('returns 503 without leaking driver details when the database query fails', async () => {
    jest.spyOn(pool, 'query').mockRejectedValueOnce(new Error('connect ECONNREFUSED 10.0.0.5:5432'));

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Database unavailable' },
    });
    expect(res.text).not.toContain('ECONNREFUSED');
  });
});
