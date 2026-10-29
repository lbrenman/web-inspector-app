const { api } = require('./helpers/apps');

const rule = (overrides = {}) => ({
  name: 'Test rule',
  pathPattern: '/hook/test*',
  status: 201,
  headers: [{ name: 'X-Test', value: 'yes' }],
  body: '{"ok":true}',
  delayMs: 0,
  ...overrides,
});

const create = async (overrides) => (await api().post('/api/reply-rules').send(rule(overrides))).body;

function expectValidationError(res) {
  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe('VALIDATION_ERROR');
  expect(res.body.error.details.length).toBeGreaterThan(0);
}

describe('GET /api/reply-rules', () => {
  it('returns an empty list when there are no rules', async () => {
    const res = await api().get('/api/reply-rules');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ rules: [] });
  });

  it('lists rules in creation order', async () => {
    const first = await create({ pathPattern: '/hook/one*' });
    const second = await create({ pathPattern: '/hook/two*' });

    const res = await api().get('/api/reply-rules');

    expect(res.body.rules.map((r) => r.id)).toEqual([first.id, second.id]);
  });
});

describe('POST /api/reply-rules', () => {
  it('creates a rule and returns it', async () => {
    const res = await api().post('/api/reply-rules').send(rule());

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: expect.any(Number), ...rule() });
  });

  it('applies defaults for headers, body and delay', async () => {
    const res = await api()
      .post('/api/reply-rules')
      .send({ name: 'Minimal', pathPattern: '*', status: 202 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ headers: [], body: '', delayMs: 0, status: 202 });
  });

  it('trims the name and pattern but keeps the body exactly as written', async () => {
    const res = await api()
      .post('/api/reply-rules')
      .send(rule({ name: '  Padded  ', pathPattern: '  /hook/p*  ', body: '  keep me \n' }));

    expect(res.body).toMatchObject({
      name: 'Padded',
      pathPattern: '/hook/p*',
      body: '  keep me \n',
    });
  });

  it.each([
    ['a missing name', { name: undefined }],
    ['an empty name', { name: '   ' }],
    ['a pattern outside /hook', { pathPattern: '/other' }],
    ['a pattern without a leading slash', { pathPattern: 'hook/a' }],
    ['a wildcard in the middle', { pathPattern: '/hook/a*b' }],
    ['a double wildcard', { pathPattern: '**' }],
    ['a pattern containing whitespace', { pathPattern: '/hook/a b' }],
    ['a status below 200', { status: 199 }],
    ['a status above 599', { status: 600 }],
    ['a non-integer status', { status: 200.5 }],
    ['a string status', { status: '200' }],
    ['a negative delay', { delayMs: -1 }],
    ['a delay over 10 seconds', { delayMs: 10001 }],
    ['a body over 64 KB', { body: 'x'.repeat(65537) }],
    ['a body containing a NUL character', { body: 'a\u0000b' }],
    ['a managed header (Content-Length)', { headers: [{ name: 'Content-Length', value: '1' }] }],
    ['a managed header (transfer-encoding)', { headers: [{ name: 'transfer-encoding', value: 'chunked' }] }],
    ['an invalid header name', { headers: [{ name: 'Bad Name', value: 'x' }] }],
    ['a header value with a newline', { headers: [{ name: 'X-A', value: 'a\r\nInjected: 1' }] }],
    ['a header value outside Latin-1', { headers: [{ name: 'X-A', value: '€' }] }],
    ['an unknown header field', { headers: [{ name: 'X-A', value: 'x', extra: 1 }] }],
    ['more than 30 headers', { headers: Array.from({ length: 31 }, (_, i) => ({ name: `X-${i}`, value: 'v' })) }],
    ['an unknown field', { extra: true }],
  ])('rejects %s', async (_label, overrides) => {
    const res = await api().post('/api/reply-rules').send(rule(overrides));

    expectValidationError(res);
    expect((await api().get('/api/reply-rules')).body.rules).toEqual([]);
  });

  it('rejects a second rule for the same pattern, ignoring case, with 409', async () => {
    await create({ pathPattern: '/hook/dup*' });

    const res = await api()
      .post('/api/reply-rules')
      .send(rule({ pathPattern: '/HOOK/DUP*' }));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('rejects malformed JSON with INVALID_JSON', async () => {
    const res = await api()
      .post('/api/reply-rules')
      .set('Content-Type', 'application/json')
      .send('{"name":');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });
});

describe('PUT /api/reply-rules/:id', () => {
  it('replaces the rule', async () => {
    const created = await create();

    const res = await api()
      .put(`/api/reply-rules/${created.id}`)
      .send(rule({ name: 'Renamed', status: 503, headers: [], body: 'down', delayMs: 250 }));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: created.id,
      name: 'Renamed',
      pathPattern: '/hook/test*',
      status: 503,
      headers: [],
      body: 'down',
      delayMs: 250,
    });
  });

  it('allows keeping the same pattern', async () => {
    const created = await create();

    const res = await api().put(`/api/reply-rules/${created.id}`).send(rule({ status: 202 }));

    expect(res.status).toBe(200);
  });

  it('returns 409 when the new pattern belongs to another rule', async () => {
    await create({ pathPattern: '/hook/one*' });
    const second = await create({ pathPattern: '/hook/two*' });

    const res = await api()
      .put(`/api/reply-rules/${second.id}`)
      .send(rule({ pathPattern: '/hook/one*' }));

    expect(res.status).toBe(409);
  });

  it('returns 404 for a rule that does not exist', async () => {
    const res = await api().put('/api/reply-rules/999999').send(rule());

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('validates the id and the body', async () => {
    const created = await create();

    expectValidationError(await api().put('/api/reply-rules/abc').send(rule()));
    expectValidationError(await api().put(`/api/reply-rules/${created.id}`).send(rule({ status: 99 })));
  });
});

describe('DELETE /api/reply-rules/:id', () => {
  it('deletes the rule', async () => {
    const created = await create();

    const res = await api().delete(`/api/reply-rules/${created.id}`);

    expect(res.status).toBe(204);
    expect((await api().get('/api/reply-rules')).body.rules).toEqual([]);
  });

  it('returns 404 when the rule does not exist', async () => {
    const res = await api().delete('/api/reply-rules/999999');

    expect(res.status).toBe(404);
  });

  it('rejects an invalid id', async () => {
    expectValidationError(await api().delete('/api/reply-rules/abc'));
  });
});
