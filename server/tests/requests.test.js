const { api, capture, captureJson } = require('./helpers/apps');

function expectValidationError(res) {
  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe('VALIDATION_ERROR');
  expect(res.body.error.details.length).toBeGreaterThan(0);
}

describe('GET /api/requests', () => {
  it('returns an empty page when nothing has been captured', async () => {
    const res = await api().get('/api/requests');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], hasMore: false });
  });

  it('returns summaries newest first', async () => {
    const first = await captureJson({ n: 1 }, '/hook/a');
    const second = await capture()
      .put('/hook/b?q=1')
      .set('Content-Type', 'text/plain')
      .send('hello');

    const res = await api().get('/api/requests');

    expect(res.status).toBe(200);
    expect(res.body.hasMore).toBe(false);
    expect(res.body.items.map((r) => r.id)).toEqual([second.body.id, first]);
    expect(res.body.items[0]).toEqual({
      id: second.body.id,
      receivedAt: expect.any(String),
      method: 'PUT',
      path: '/hook/b',
      queryString: 'q=1',
      contentType: expect.stringMatching(/^text\/plain/),
      bodySize: 5,
      isJson: false,
    });
    expect(res.body.items[1]).toMatchObject({ method: 'POST', isJson: true });
  });

  it('paginates with limit and before', async () => {
    const ids = [];
    for (let i = 0; i < 3; i += 1) {
      ids.push(await captureJson({ i }));
    }
    const [oldest, middle, newest] = ids;

    const page1 = (await api().get('/api/requests?limit=2')).body;
    expect(page1.items.map((r) => r.id)).toEqual([newest, middle]);
    expect(page1.hasMore).toBe(true);

    const page2 = (await api().get(`/api/requests?limit=2&before=${middle}`)).body;
    expect(page2.items.map((r) => r.id)).toEqual([oldest]);
    expect(page2.hasMore).toBe(false);
  });

  it.each([
    'limit=0',
    'limit=201',
    'limit=abc',
    'limit=1.5',
    'before=0',
    'before=-1',
    'before=abc',
    'limit=1&limit=2',
  ])('rejects invalid query "%s"', async (query) => {
    expectValidationError(await api().get(`/api/requests?${query}`));
  });
});

describe('GET /api/requests/:id', () => {
  it('returns headers, query, body and no tables for a simple payload', async () => {
    const id = await captureJson({ a: 1 });

    const res = await api().get(`/api/requests/${id}`);

    expect(res.status).toBe(200);
    expect(res.body.tables).toEqual([]);
    expect(res.body.headers.length).toBeGreaterThan(0);
    expect(res.body.query).toEqual([]);
  });

  it('detects tables inside the payload', async () => {
    const id = await captureJson({
      data: { users: [{ id: 1, name: 'a', address: { city: 'X' } }, { id: 2, name: 'b' }] },
      tags: ['a', 'b'],
    });

    const { tables } = (await api().get(`/api/requests/${id}`)).body;

    expect(tables).toEqual([
      {
        path: '$.data.users',
        totalRows: 2,
        columns: ['id', 'name', 'address.city'],
        columnsTruncated: false,
        rows: [
          [1, 'a', 'X'],
          [2, 'b', null],
        ],
      },
    ]);
  });

  it('detects a root-level array of objects', async () => {
    const id = await captureJson([{ a: 1 }, { a: 2 }, { a: 3 }]);

    const { tables } = (await api().get(`/api/requests/${id}`)).body;

    expect(tables).toHaveLength(1);
    expect(tables[0]).toMatchObject({ path: '$', columns: ['a'], totalRows: 3 });
  });

  it('returns 404 for an id that does not exist', async () => {
    const res = await api().get('/api/requests/999999');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it.each(['abc', '0', '-1', '1.5', '1e3', '99999999999'])(
    'rejects the invalid id "%s"',
    async (id) => {
      expectValidationError(await api().get(`/api/requests/${id}`));
    },
  );
});

describe('DELETE /api/requests/:id', () => {
  it('deletes one request', async () => {
    const keep = await captureJson({ keep: true });
    const drop = await captureJson({ drop: true });

    const res = await api().delete(`/api/requests/${drop}`);
    expect(res.status).toBe(204);

    expect((await api().get(`/api/requests/${drop}`)).status).toBe(404);
    expect((await api().get(`/api/requests/${keep}`)).status).toBe(200);
  });

  it('returns 404 when the request does not exist', async () => {
    const res = await api().delete('/api/requests/999999');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('rejects an invalid id', async () => {
    expectValidationError(await api().delete('/api/requests/abc'));
  });
});

describe('DELETE /api/requests', () => {
  it('clears everything and reports how many were removed', async () => {
    await captureJson({ a: 1 });
    await captureJson({ a: 2 });

    const res = await api().delete('/api/requests');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: 2 });
    expect((await api().get('/api/requests')).body.items).toEqual([]);
  });

  it('is a no-op on an empty store', async () => {
    const res = await api().delete('/api/requests');

    expect(res.body).toEqual({ deleted: 0 });
  });
});

describe('unknown inspector routes', () => {
  it('returns a JSON 404', async () => {
    const res = await api().get('/api/nope');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });
});
