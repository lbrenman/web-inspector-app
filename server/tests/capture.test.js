const request = require('supertest');
const { api, capture, captureJson, inspectorApp } = require('./helpers/apps');

const header = (detail, name) =>
  detail.headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;

describe('capture endpoint (/hook)', () => {
  it('records a JSON POST with its headers, query and body, and acknowledges it', async () => {
    const res = await capture()
      .post('/hook?source=postman&x=1&x=2')
      .set('X-Custom-Header', 'abc')
      .send({ hello: 'world', n: 1 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true, id: expect.any(Number) });

    const detail = (await api().get(`/api/requests/${res.body.id}`)).body;
    expect(detail).toMatchObject({
      id: res.body.id,
      method: 'POST',
      path: '/hook',
      queryString: 'source=postman&x=1&x=2',
      httpVersion: '1.1',
    });
    expect(detail.query).toEqual([
      { name: 'source', value: 'postman' },
      { name: 'x', value: '1' },
      { name: 'x', value: '2' },
    ]);
    expect(header(detail, 'x-custom-header')).toBe('abc');
    expect(header(detail, 'content-type')).toMatch(/application\/json/);
    expect(detail.body).toMatchObject({ encoding: 'utf8', isJson: true });
    expect(JSON.parse(detail.body.text)).toEqual({ hello: 'world', n: 1 });
    expect(detail.body).not.toHaveProperty('value');
  });

  it.each(['get', 'put', 'patch', 'delete', 'options', 'head'])(
    'records %s requests',
    async (verb) => {
      const res = await capture()[verb]('/hook');

      expect(res.status).toBe(200);

      const list = (await api().get('/api/requests')).body;
      expect(list.items).toHaveLength(1);
      expect(list.items[0].method).toBe(verb.toUpperCase());
    },
  );

  it('records sub-paths under /hook', async () => {
    const id = await captureJson({ a: 1 }, '/hook/orders/42');

    const detail = (await api().get(`/api/requests/${id}`)).body;
    expect(detail.path).toBe('/hook/orders/42');
  });

  it('stores binary bodies as base64 and preserves the bytes', async () => {
    const bytes = Buffer.from([0xff, 0xfe, 0x00, 0x01]);

    const res = await capture()
      .post('/hook')
      .set('Content-Type', 'application/octet-stream')
      .send(bytes);

    const detail = (await api().get(`/api/requests/${res.body.id}`)).body;
    expect(detail.body).toMatchObject({
      encoding: 'base64',
      size: 4,
      base64: bytes.toString('base64'),
      isJson: false,
    });
  });

  it('stores form-encoded bodies as text', async () => {
    const res = await capture().post('/hook').type('form').send({ a: '1', b: 'two' });

    const detail = (await api().get(`/api/requests/${res.body.id}`)).body;
    expect(detail.body).toMatchObject({ encoding: 'utf8', text: 'a=1&b=two', isJson: false });
  });

  it('records requests without a body', async () => {
    const res = await capture().post('/hook');

    const detail = (await api().get(`/api/requests/${res.body.id}`)).body;
    expect(detail.body).toMatchObject({ encoding: 'empty', size: 0 });
  });

  it('detects JSON even when the content type is wrong', async () => {
    const res = await capture().post('/hook').set('Content-Type', 'text/plain').send('{"a":1}');

    const detail = (await api().get(`/api/requests/${res.body.id}`)).body;
    expect(detail.body.isJson).toBe(true);
  });

  it('still captures malformed JSON, keeping the text as sent', async () => {
    const res = await capture()
      .post('/hook')
      .set('Content-Type', 'application/json')
      .send('{"a":');

    expect(res.status).toBe(200);
    const detail = (await api().get(`/api/requests/${res.body.id}`)).body;
    expect(detail.body).toMatchObject({ encoding: 'utf8', text: '{"a":', isJson: false });
    expect(detail.tables).toEqual([]);
  });

  it.each([
    ['a NUL escape', '{"a":"\\u0000"}'],
    ['a lone surrogate escape', '{"a":"\\ud800"}'],
  ])('still captures JSON that jsonb cannot store (%s)', async (_label, text) => {
    const res = await capture().post('/hook').set('Content-Type', 'application/json').send(text);

    expect(res.status).toBe(200);
    const detail = (await api().get(`/api/requests/${res.body.id}`)).body;
    expect(detail.body.text).toBe(text);
  });

  it('rejects bodies over the size limit with 413 and does not store them', async () => {
    const res = await capture().post('/hook').send('x'.repeat(5000));

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');

    const list = (await api().get('/api/requests')).body;
    expect(list.items).toEqual([]);
  });

  it('keeps only the newest MAX_STORED_REQUESTS requests', async () => {
    let lastId;
    for (let i = 0; i < 55; i += 1) {
      lastId = await captureJson({ i });
    }

    const list = (await api().get('/api/requests?limit=200')).body;
    expect(list.items).toHaveLength(50);
    expect(list.items[0].id).toBe(lastId);
  });

  it('serves only /hook: other paths are 404 and are not recorded', async () => {
    const paths = ['/', '/other', '/api/requests', '/api/stream', '/hooks'];

    for (const path of paths) {
      const res = await capture().get(path);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    }

    const list = (await api().get('/api/requests')).body;
    expect(list.items).toEqual([]);
  });
});

describe('inspector API isolation', () => {
  it('does not accept captures', async () => {
    const res = await request(inspectorApp).post('/hook').send({ a: 1 });

    expect(res.status).toBe(404);
  });
});
