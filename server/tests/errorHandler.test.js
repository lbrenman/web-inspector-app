const express = require('express');
const request = require('supertest');
const HttpError = require('../src/errors/HttpError');
const errorHandler = require('../src/middleware/errorHandler');

function buildApp() {
  const app = express();

  app.get('/http-error', () => {
    throw new HttpError(409, 'CONFLICT', 'Already exists', [{ path: 'name' }]);
  });
  app.get('/http-error-no-details', () => {
    throw new HttpError(404, 'NOT_FOUND', 'Missing');
  });
  app.get('/sync-boom', () => {
    throw new Error('secret internals: password=hunter2');
  });
  app.get('/async-boom', async () => {
    throw new Error('secret internals: password=hunter2');
  });

  app.use(errorHandler);
  return app;
}

describe('errorHandler', () => {
  const app = buildApp();

  it('maps HttpError to its status, code, message and details', async () => {
    const res = await request(app).get('/http-error');

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: { code: 'CONFLICT', message: 'Already exists', details: [{ path: 'name' }] },
    });
  });

  it('omits details when the HttpError has none', async () => {
    const res = await request(app).get('/http-error-no-details');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Missing' } });
  });

  it.each(['/sync-boom', '/async-boom'])(
    'returns a generic 500 and leaks nothing for unexpected errors thrown by %s',
    async (path) => {
      const res = await request(app).get(path);

      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      });
      expect(res.text).not.toContain('hunter2');
      expect(res.text).not.toContain('stack');
    },
  );
});
