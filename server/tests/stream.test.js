const http = require('node:http');
const { once } = require('node:events');
const { api, capture, captureJson, inspectorApp } = require('./helpers/apps');

function waitFor(predicate, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      if (predicate()) return resolve();
      if (Date.now() - started > timeoutMs) return reject(new Error('Timed out waiting'));
      return setTimeout(tick, 20);
    };
    tick();
  });
}

/** Parses the SSE text received so far into [{ event, data }]. */
function parseEvents(buffer) {
  return buffer
    .split('\n\n')
    .map((block) => {
      const event = /^event: (.+)$/m.exec(block)?.[1];
      const data = /^data: (.+)$/m.exec(block)?.[1];
      return event ? { event, data: JSON.parse(data) } : null;
    })
    .filter(Boolean);
}

describe('GET /api/stream (SSE)', () => {
  let server;
  let req;
  let buffer;

  async function connect() {
    server = inspectorApp.listen(0, '127.0.0.1');
    await once(server, 'listening');

    buffer = '';
    req = http.get({ host: '127.0.0.1', port: server.address().port, path: '/api/stream' });
    const [res] = await once(req, 'response');
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      buffer += chunk;
    });
    await waitFor(() => buffer.includes(': connected'));
    return res;
  }

  afterEach(async () => {
    req?.destroy();
    server?.closeAllConnections();
    await new Promise((resolve) => server?.close(resolve) ?? resolve());
    req = undefined;
    server = undefined;
  });

  it('streams text/event-stream headers', async () => {
    const res = await connect();

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/event-stream/);
  });

  it('pushes new captures, deletions and clears as they happen', async () => {
    await connect();

    const id = await captureJson({ hello: 'world' }, '/hook/live');
    await waitFor(() => parseEvents(buffer).some((e) => e.event === 'request'));
    expect(parseEvents(buffer).find((e) => e.event === 'request').data).toMatchObject({
      id,
      method: 'POST',
      path: '/hook/live',
      isJson: true,
    });

    await api().delete(`/api/requests/${id}`);
    await waitFor(() => parseEvents(buffer).some((e) => e.event === 'deleted'));
    expect(parseEvents(buffer).find((e) => e.event === 'deleted').data).toEqual({ id });

    await capture().get('/hook');
    await api().delete('/api/requests');
    await waitFor(() => parseEvents(buffer).some((e) => e.event === 'cleared'));
  });

  it('does not emit events for rejected captures', async () => {
    await connect();

    await capture().post('/hook').send('x'.repeat(5000));
    await captureJson({ marker: true });
    await waitFor(() => parseEvents(buffer).some((e) => e.event === 'request'));

    const requestEvents = parseEvents(buffer).filter((e) => e.event === 'request');
    expect(requestEvents).toHaveLength(1);
    expect(requestEvents[0].data.bodySize).toBeLessThan(100);
  });
});
