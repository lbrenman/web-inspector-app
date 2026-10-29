const { api } = require('./helpers/apps');
const { pool } = require('../src/db/pool');

describe('GET /api/health', () => {
  it('reports ok when the database is reachable', async () => {
    const res = await api().get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', database: 'up' });
  });

  it('returns 503 without leaking driver details when the database query fails', async () => {
    jest
      .spyOn(pool, 'query')
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED 10.0.0.5:5432'));

    const res = await api().get('/api/health');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Database unavailable' },
    });
    expect(res.text).not.toContain('ECONNREFUSED');
  });
});

describe('GET /api/info', () => {
  it('returns the capture URL and limits', async () => {
    const res = await api().get('/api/info');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      captureUrl: 'https://capture.example.test/hook',
      maxBodyBytes: 4096,
      maxStoredRequests: 50,
    });
  });
});
