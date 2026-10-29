const { api, capture } = require('./helpers/apps');

const addRule = async (overrides) => {
  const res = await api()
    .post('/api/reply-rules')
    .send({
      name: 'Rule',
      pathPattern: '/hook/custom*',
      status: 202,
      headers: [{ name: 'X-Reply', value: 'custom' }],
      body: '{"accepted":true}',
      delayMs: 0,
      ...overrides,
    });
  expect(res.status).toBe(201);
  return res.body;
};

const detailOf = async (id) => (await api().get(`/api/requests/${id}`)).body;

describe('replies sent by /hook', () => {
  it('sends the default reply when no rule matches', async () => {
    const res = await capture().post('/hook').send({ a: 1 });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/json; charset=utf-8');
    expect(res.body).toEqual({ received: true, id: expect.any(Number) });
  });

  it('records the reply that was sent, next to the request', async () => {
    const res = await capture().post('/hook/plain').send({ a: 1 });

    const { response } = await detailOf(res.body.id);

    expect(response).toMatchObject({
      status: 200,
      rule: null,
      delayMs: 0,
      body: { encoding: 'utf8', isJson: true, text: `{"received":true,"id":${res.body.id}}` },
    });
    expect(response.headers).toEqual([
      { name: 'Content-Type', value: 'application/json; charset=utf-8' },
      { name: 'Content-Length', value: String(response.body.size) },
    ]);
  });

  it('shows the reply status in the request list', async () => {
    await addRule({ status: 418 });
    await capture().post('/hook/custom');

    const list = (await api().get('/api/requests')).body;

    expect(list.items[0].responseStatus).toBe(418);
  });

  it('sends a matching rule: status, headers and body', async () => {
    await addRule();

    const res = await capture().post('/hook/custom/thing').send({ a: 1 });

    expect(res.status).toBe(202);
    expect(res.headers['x-reply']).toBe('custom');
    expect(res.headers['content-type']).toBe('application/json; charset=utf-8');
    expect(res.text).toBe('{"accepted":true}');
  });

  it('records the rule name and exactly what was sent', async () => {
    await addRule({ name: 'My rule' });

    await capture().post('/hook/custom');
    const { response } = await detailOf((await api().get('/api/requests')).body.items[0].id);

    expect(response).toMatchObject({ status: 202, rule: 'My rule', delayMs: 0 });
    expect(response.body.text).toBe('{"accepted":true}');
    expect(response.headers.map((h) => h.name)).toEqual(['X-Reply', 'Content-Type', 'Content-Length']);
  });

  it('applies the most specific rule', async () => {
    await addRule({ name: 'all', pathPattern: '*', status: 201, body: 'all' });
    await addRule({ name: 'prefix', pathPattern: '/hook/orders*', status: 202, body: 'prefix' });
    await addRule({ name: 'exact', pathPattern: '/hook/orders/42', status: 203, body: 'exact' });

    expect((await capture().post('/hook/other')).text).toBe('all');
    expect((await capture().post('/hook/orders/7')).text).toBe('prefix');
    expect((await capture().post('/hook/orders/42')).text).toBe('exact');
    expect((await capture().post('/hook/orders/42/')).text).toBe('exact');
    expect((await capture().post('/hook')).text).toBe('all');
  });

  it('fills {{id}} and {{timestamp}} placeholders', async () => {
    await addRule({
      body: '{"id":{{id}},"at":"{{timestamp}}"}',
      headers: [{ name: 'X-Request-Id', value: 'req-{{id}}' }],
    });

    const res = await capture().post('/hook/custom');
    const { id: recorded } = (await api().get('/api/requests')).body.items[0];

    expect(res.body).toEqual({ id: recorded, at: expect.stringMatching(/^\d{4}-\d\d-\d\dT/) });
    expect(res.headers['x-request-id']).toBe(`req-${recorded}`);
  });

  it('sends no body for 204', async () => {
    await addRule({ status: 204, body: 'ignored' });

    const res = await capture().post('/hook/custom');

    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    const { response } = await detailOf((await api().get('/api/requests')).body.items[0].id);
    expect(response.body.encoding).toBe('empty');
  });

  it('can reply with an error status', async () => {
    await addRule({ status: 503, body: 'try later', headers: [{ name: 'Retry-After', value: '30' }] });

    const res = await capture().post('/hook/custom');

    expect(res.status).toBe(503);
    expect(res.headers['retry-after']).toBe('30');
    expect(res.text).toBe('try later');
  });

  it('delays the reply but stores the request immediately', async () => {
    await addRule({ delayMs: 300 });
    const started = Date.now();

    const pending = capture().post('/hook/custom').then((res) => res);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const listedEarly = (await api().get('/api/requests')).body.items;

    expect(listedEarly).toHaveLength(1);
    const res = await pending;
    expect(res.status).toBe(202);
    expect(Date.now() - started).toBeGreaterThanOrEqual(290);
  });

  it('uses edits to a rule immediately and the default again after it is deleted', async () => {
    const created = await addRule({ pathPattern: '/hook/live*', body: 'v1' });
    expect((await capture().post('/hook/live')).text).toBe('v1');

    await api()
      .put(`/api/reply-rules/${created.id}`)
      .send({ ...created, id: undefined, body: 'v2' });
    expect((await capture().post('/hook/live')).text).toBe('v2');

    await api().delete(`/api/reply-rules/${created.id}`);
    expect((await capture().post('/hook/live')).body).toEqual({
      received: true,
      id: expect.any(Number),
    });
  });

  it('does not reply (or record) anything for rejected oversized bodies', async () => {
    await addRule({ pathPattern: '*' });

    const res = await capture().post('/hook').send('x'.repeat(5000));

    expect(res.status).toBe(413);
    expect((await api().get('/api/requests')).body.items).toEqual([]);
  });
});
