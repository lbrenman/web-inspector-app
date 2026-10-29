const request = require('supertest');
const { createApp } = require('../src/app');

const app = createApp();

async function createNote(title = 'A title', body = 'A body') {
  const res = await request(app).post('/api/notes').send({ title, body });
  expect(res.status).toBe(201);
  return res.body;
}

function expectValidationError(res) {
  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe('VALIDATION_ERROR');
  expect(Array.isArray(res.body.error.details)).toBe(true);
  expect(res.body.error.details.length).toBeGreaterThan(0);
}

describe('GET /api/notes', () => {
  it('returns an empty array when there are no notes', async () => {
    const res = await request(app).get('/api/notes');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns notes newest first', async () => {
    await createNote('first');
    await createNote('second');
    await createNote('third');

    const res = await request(app).get('/api/notes');

    expect(res.status).toBe(200);
    expect(res.body.map((n) => n.title)).toEqual(['third', 'second', 'first']);
  });

  it('supports limit and offset', async () => {
    for (const title of ['a', 'b', 'c', 'd']) {
      await createNote(title);
    }

    const res = await request(app).get('/api/notes?limit=2&offset=1');

    expect(res.status).toBe(200);
    expect(res.body.map((n) => n.title)).toEqual(['c', 'b']);
  });

  it.each(['limit=0', 'limit=101', 'limit=abc', 'limit=1.5', 'offset=-1', 'limit=1&limit=2'])(
    'rejects invalid query "%s"',
    async (query) => {
      const res = await request(app).get(`/api/notes?${query}`);

      expectValidationError(res);
    },
  );
});

describe('POST /api/notes', () => {
  it('creates a note and returns it', async () => {
    const res = await request(app).post('/api/notes').send({ title: 'Hello', body: 'World' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(Number),
      title: 'Hello',
      body: 'World',
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });

    const fetched = await request(app).get(`/api/notes/${res.body.id}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body).toEqual(res.body);
  });

  it('trims surrounding whitespace', async () => {
    const res = await request(app).post('/api/notes').send({ title: '  Hello  ', body: '\nWorld\n' });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Hello');
    expect(res.body.body).toBe('World');
  });

  it('stores SQL metacharacters literally (parameterized queries)', async () => {
    const title = "Robert'); DROP TABLE notes;--";

    const created = await createNote(title, "' OR '1'='1");
    const list = await request(app).get('/api/notes');

    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ id: created.id, title, body: "' OR '1'='1" });
  });

  it.each([
    ['an empty object', {}],
    ['a missing body', { title: 't' }],
    ['a missing title', { body: 'b' }],
    ['an empty title', { title: '', body: 'b' }],
    ['a whitespace-only title', { title: '   ', body: 'b' }],
    ['a title over 200 characters', { title: 'x'.repeat(201), body: 'b' }],
    ['a body over 10000 characters', { title: 't', body: 'x'.repeat(10_001) }],
    ['a non-string title', { title: 123, body: 'b' }],
    ['an unknown field', { title: 't', body: 'b', extra: true }],
  ])('rejects %s', async (_label, payload) => {
    const res = await request(app).post('/api/notes').send(payload);

    expectValidationError(res);

    const list = await request(app).get('/api/notes');
    expect(list.body).toEqual([]);
  });

  it('rejects a request that is not JSON', async () => {
    const res = await request(app).post('/api/notes').set('Content-Type', 'text/plain').send('hello');

    expectValidationError(res);
  });

  it('rejects malformed JSON with INVALID_JSON', async () => {
    const res = await request(app)
      .post('/api/notes')
      .set('Content-Type', 'application/json')
      .send('{"title":');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('rejects bodies over the size limit with 413', async () => {
    const res = await request(app)
      .post('/api/notes')
      .send({ title: 't', body: 'x'.repeat(200_000) });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

describe('GET /api/notes/:id', () => {
  it('returns the note', async () => {
    const created = await createNote('Find me', 'Body');

    const res = await request(app).get(`/api/notes/${created.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(created);
  });

  it('returns 404 for an id that does not exist', async () => {
    const res = await request(app).get('/api/notes/999999');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it.each(['abc', '0', '-1', '1.5', '1e3', '99999999999'])(
    'rejects the invalid id "%s"',
    async (id) => {
      const res = await request(app).get(`/api/notes/${id}`);

      expectValidationError(res);
    },
  );
});

describe('DELETE /api/notes/:id', () => {
  it('deletes the note', async () => {
    const created = await createNote();

    const res = await request(app).delete(`/api/notes/${created.id}`);
    expect(res.status).toBe(204);
    expect(res.text).toBe('');

    const after = await request(app).get(`/api/notes/${created.id}`);
    expect(after.status).toBe(404);
  });

  it('returns 404 when the note does not exist', async () => {
    const res = await request(app).delete('/api/notes/999999');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 when deleting the same note twice', async () => {
    const created = await createNote();

    await request(app).delete(`/api/notes/${created.id}`);
    const second = await request(app).delete(`/api/notes/${created.id}`);

    expect(second.status).toBe(404);
  });

  it('rejects an invalid id', async () => {
    const res = await request(app).delete('/api/notes/abc');

    expectValidationError(res);
  });
});

describe('unknown routes', () => {
  it('returns a JSON 404', async () => {
    const res = await request(app).get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });
});
