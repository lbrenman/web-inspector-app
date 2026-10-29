const { api, capture, captureJson } = require('./helpers/apps');

describe('GET /api/patterns', () => {
  it('returns no patterns when nothing has been captured', async () => {
    const res = await api().get('/api/patterns');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ patterns: [] });
  });

  it('groups JSON-object payloads that share the same top-level keys', async () => {
    await captureJson({ event: 'created', id: 1 });
    await captureJson({ id: 2, event: 'updated' }); // same keys, different order
    await captureJson({ other: true }); // different shape, only one occurrence

    const { patterns } = (await api().get('/api/patterns')).body;

    expect(patterns).toHaveLength(1);
    expect(patterns[0]).toMatchObject({
      id: expect.stringMatching(/^[0-9a-f]{40}$/),
      count: 2,
      firstSeen: expect.any(String),
      lastSeen: expect.any(String),
    });
    expect([...patterns[0].keys].sort()).toEqual(['event', 'id']);
  });

  it('does not group arrays, scalars, empty objects, non-JSON or malformed bodies', async () => {
    await captureJson([{ a: 1 }]);
    await captureJson([{ a: 1 }]);
    await captureJson({});
    await captureJson({});
    await capture().post('/hook').set('Content-Type', 'text/plain').send('plain');
    await capture().post('/hook').set('Content-Type', 'text/plain').send('plain');
    await capture().post('/hook').set('Content-Type', 'application/json').send('{"a":');
    await capture().post('/hook').set('Content-Type', 'application/json').send('{"a":');

    const { patterns } = (await api().get('/api/patterns')).body;

    expect(patterns).toEqual([]);
  });

  it('lists the most recently active pattern first', async () => {
    await captureJson({ a: 1 });
    await captureJson({ a: 2 });
    await captureJson({ b: 1 });
    await captureJson({ b: 2 });

    const { patterns } = (await api().get('/api/patterns')).body;

    expect(patterns.map((p) => p.keys)).toEqual([['b'], ['a']]);
  });

  it('drops a pattern when deletes leave fewer than two matching requests', async () => {
    await captureJson({ a: 1 });
    const second = await captureJson({ a: 2 });

    await api().delete(`/api/requests/${second}`);

    expect((await api().get('/api/patterns')).body.patterns).toEqual([]);
  });
});

describe('GET /api/patterns/:hash/table', () => {
  it('returns one row per request with flattened columns, newest first', async () => {
    const first = await captureJson({ id: 1, user: { name: 'ann', age: 30 }, tags: ['x'] });
    const second = await captureJson({ id: 2, user: { name: 'bob', age: 41 }, tags: [] });
    const { patterns } = (await api().get('/api/patterns')).body;

    const res = await api().get(`/api/patterns/${patterns[0].id}/table`);

    expect(res.status).toBe(200);
    expect(res.body.totalRows).toBe(2);
    expect(res.body.columnsTruncated).toBe(false);
    expect([...res.body.columns].sort()).toEqual(['id', 'tags', 'user.age', 'user.name']);

    const byColumn = (row, column) => row[res.body.columns.indexOf(column)];
    expect(res.body.rowMeta.map((m) => m.id)).toEqual([second, first]);
    expect(res.body.rows.map((row) => byColumn(row, 'user.name'))).toEqual(['bob', 'ann']);
    expect(res.body.rows.map((row) => byColumn(row, 'tags'))).toEqual(['[]', '["x"]']);
    expect(res.body.rows.map((row) => byColumn(row, 'id'))).toEqual([2, 1]);
  });

  it('returns 404 for a well-formed hash that matches nothing', async () => {
    const res = await api().get(`/api/patterns/${'0'.repeat(40)}/table`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it.each(['abc', 'Z'.repeat(40), 'A'.repeat(40), '0'.repeat(39)])(
    'rejects the malformed hash "%s"',
    async (hash) => {
      const res = await api().get(`/api/patterns/${hash}/table`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    },
  );
});
