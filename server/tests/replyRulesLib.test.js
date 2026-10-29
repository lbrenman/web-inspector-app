const { DEFAULT_RULE, matchesPattern, renderReply, selectRule } = require('../src/lib/replyRules');

describe('matchesPattern', () => {
  it.each([
    ['*', '/hook', true],
    ['*', '/hook/anything/at/all', true],
    ['/hook/a', '/hook/a', true],
    ['/hook/a', '/hook/a/', true],
    ['/hook/a/', '/hook/a', true],
    ['/hook/a', '/HOOK/A', true],
    ['/hook/a', '/hook/a/b', false],
    ['/hook/a', '/hook/ab', false],
    ['/hook/services/collector*', '/hook/services/collector', true],
    ['/hook/services/collector*', '/hook/services/collector/event', true],
    ['/hook/services/collector*', '/hook/services', false],
    ['/hook*', '/hook', true],
  ])('pattern %s vs path %s -> %s', (pattern, path, expected) => {
    expect(matchesPattern(pattern, path)).toBe(expected);
  });
});

describe('selectRule', () => {
  const rules = [
    { id: 1, pathPattern: '*' },
    { id: 2, pathPattern: '/hook/a*' },
    { id: 3, pathPattern: '/hook/a/b*' },
    { id: 4, pathPattern: '/hook/a/b/c' },
  ];

  it.each([
    ['/hook/a/b/c', 4],
    ['/hook/a/b/c/', 4],
    ['/hook/a/b/d', 3],
    ['/hook/a/x', 2],
    ['/hook/zzz', 1],
  ])('picks the most specific rule for %s', (path, id) => {
    expect(selectRule(rules, path).id).toBe(id);
  });

  it('returns null when nothing matches', () => {
    expect(selectRule([{ id: 1, pathPattern: '/hook/a*' }], '/hook/b')).toBeNull();
    expect(selectRule([], '/hook')).toBeNull();
  });

  it('breaks ties between equally specific rules by lowest id', () => {
    const tied = [
      { id: 9, pathPattern: '/hook/a' },
      { id: 5, pathPattern: '/HOOK/A' },
    ];

    expect(selectRule(tied, '/hook/a').id).toBe(5);
  });
});

describe('renderReply', () => {
  it('renders the default reply with the request id', () => {
    const reply = renderReply(null, { id: 12, timestamp: 'T' });

    expect(reply).toEqual({
      status: 200,
      headers: [
        ['Content-Type', 'application/json; charset=utf-8'],
        ['Content-Length', '25'],
      ],
      body: '{"received":true,"id":12}',
      delayMs: 0,
      ruleName: null,
    });
    expect(DEFAULT_RULE.body).toContain('{{id}}');
  });

  it('fills {{id}} and {{timestamp}} in the body and header values', () => {
    const reply = renderReply(
      {
        name: 'R',
        status: 201,
        headers: [{ name: 'X-Id', value: 'req-{{ id }}' }],
        body: 'id={{id}} at {{timestamp}}',
        delayMs: 50,
      },
      { id: 7, timestamp: '2026-01-01T00:00:00.000Z' },
    );

    expect(reply.body).toBe('id=7 at 2026-01-01T00:00:00.000Z');
    expect(reply.headers[0]).toEqual(['X-Id', 'req-7']);
    expect(reply).toMatchObject({ status: 201, delayMs: 50, ruleName: 'R' });
  });

  it('adds Content-Type when missing, based on whether the body is JSON', () => {
    const json = renderReply(
      { name: 'j', status: 200, headers: [], body: '{"a":1}', delayMs: 0 },
      { id: 1 },
    );
    const text = renderReply(
      { name: 't', status: 200, headers: [], body: 'hello', delayMs: 0 },
      { id: 1 },
    );

    expect(json.headers[0]).toEqual(['Content-Type', 'application/json; charset=utf-8']);
    expect(text.headers[0]).toEqual(['Content-Type', 'text/plain; charset=utf-8']);
  });

  it('keeps an explicit Content-Type, whatever its case', () => {
    const reply = renderReply(
      {
        name: 'c',
        status: 200,
        headers: [{ name: 'content-type', value: 'text/csv' }],
        body: 'a,b',
        delayMs: 0,
      },
      { id: 1 },
    );

    expect(reply.headers.filter(([name]) => name.toLowerCase() === 'content-type')).toEqual([
      ['content-type', 'text/csv'],
    ]);
  });

  it('computes Content-Length in bytes, not characters', () => {
    const reply = renderReply(
      { name: 'u', status: 200, headers: [], body: 'héllo', delayMs: 0 },
      { id: 1 },
    );

    expect(reply.headers.at(-1)).toEqual(['Content-Length', '6']);
  });

  it('sends no body and no Content-Length for 204, 205 and 304', () => {
    for (const status of [204, 205, 304]) {
      const reply = renderReply(
        { name: 'n', status, headers: [{ name: 'X-A', value: '1' }], body: 'ignored', delayMs: 0 },
        { id: 1 },
      );

      expect(reply.body).toBe('');
      expect(reply.headers).toEqual([['X-A', '1']]);
    }
  });

  it('does not add Content-Type for an empty body', () => {
    const reply = renderReply(
      { name: 'e', status: 202, headers: [], body: '', delayMs: 0 },
      { id: 1 },
    );

    expect(reply.headers).toEqual([['Content-Length', '0']]);
  });
});
