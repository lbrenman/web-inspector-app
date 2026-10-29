import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.jsx';
import {
  detail,
  FakeEventSource,
  INFO,
  mockApi,
  reply,
  replyRule,
  summary,
} from './test/helpers.js';

const LIST = 'GET /api/requests?limit=50';
const HASH = 'a'.repeat(40);

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal('EventSource', FakeEventSource);
});

function emit(type, data) {
  act(() => FakeEventSource.instances[0].emit(type, data));
}

describe('request list and detail', () => {
  it('shows the capture URL and lists captured requests', async () => {
    mockApi({
      'GET /api/info': { body: INFO },
      [LIST]: { body: { items: [summary(), summary({ id: 2, method: 'GET', path: '/hook/ping' })], hasMore: false } },
    });

    render(<App />);

    expect(await screen.findByText('https://capture.example.test/hook')).toBeInTheDocument();
    expect(await screen.findByText('/hook/orders')).toBeInTheDocument();
    expect(screen.getByText('/hook/ping')).toBeInTheDocument();
  });

  it('shows headers, query parameters and the body of the selected request', async () => {
    const user = userEvent.setup();
    mockApi({
      'GET /api/info': { body: INFO },
      [LIST]: { body: { items: [summary()], hasMore: false } },
      'GET /api/requests/1': { body: detail() },
    });

    render(<App />);
    await user.click(await screen.findByText('/hook/orders'));

    const headers = await screen.findByRole('table', { name: 'Request headers' });
    expect(within(headers).getByText('X-Api-Key')).toBeInTheDocument();
    expect(within(headers).getByText('secret-123')).toBeInTheDocument();

    const query = screen.getByRole('table', { name: 'Query parameters' });
    expect(within(query).getByText('postman')).toBeInTheDocument();
    expect(screen.getByLabelText('Request body (pretty JSON)')).toHaveTextContent('"hello": "world"');
  });

  it('shows detected tables on a Tables tab', async () => {
    const user = userEvent.setup();
    const tables = [
      {
        path: '$.users',
        totalRows: 2,
        columns: ['id', 'address.city'],
        columnsTruncated: false,
        rows: [
          [1, 'X'],
          [2, null],
        ],
      },
    ];
    mockApi({
      'GET /api/info': { body: INFO },
      [LIST]: { body: { items: [summary()], hasMore: false } },
      'GET /api/requests/1': { body: detail({ tables }) },
    });

    render(<App />);
    await user.click(await screen.findByText('/hook/orders'));
    await user.click(await screen.findByRole('tab', { name: 'Tables (1)' }));

    expect(screen.getByRole('columnheader', { name: 'address.city' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'X' })).toBeInTheDocument();
  });

  it('shows an error when the selected request no longer exists', async () => {
    const user = userEvent.setup();
    mockApi({
      'GET /api/info': { body: INFO },
      [LIST]: { body: { items: [summary()], hasMore: false } },
      'GET /api/requests/1': {
        status: 404,
        body: { error: { code: 'NOT_FOUND', message: 'Request not found' } },
      },
    });

    render(<App />);
    await user.click(await screen.findByText('/hook/orders'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Request not found');
  });

  it('loads older requests', async () => {
    const user = userEvent.setup();
    const { calls } = mockApi({
      'GET /api/info': { body: INFO },
      [LIST]: { body: { items: [summary({ id: 5, path: '/hook/new' })], hasMore: true } },
      'GET /api/requests?limit=50&before=5': {
        body: { items: [summary({ id: 4, path: '/hook/old' })], hasMore: false },
      },
    });

    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Load older' }));

    expect(await screen.findByText('/hook/old')).toBeInTheDocument();
    expect(screen.getByText('/hook/new')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load older' })).not.toBeInTheDocument();
    expect(calls).toContain('GET /api/requests?limit=50&before=5');
  });

  it('shows an error when the list cannot be loaded', async () => {
    mockApi({
      'GET /api/info': { body: INFO },
      [LIST]: {
        status: 500,
        body: { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      },
    });

    render(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Internal server error');
  });
});

describe('live updates', () => {
  it('prepends requests pushed over the event stream and removes deleted ones', async () => {
    mockApi({ 'GET /api/info': { body: INFO }, [LIST]: { body: { items: [], hasMore: false } } });

    render(<App />);
    expect(await screen.findByText(/No requests yet/)).toBeInTheDocument();

    emit('request', summary({ id: 7, path: '/hook/live' }));
    expect(await screen.findByText('/hook/live')).toBeInTheDocument();

    // A duplicate delivery must not create a second entry.
    emit('request', summary({ id: 7, path: '/hook/live' }));
    expect(screen.getAllByText('/hook/live')).toHaveLength(1);

    emit('deleted', { id: 7 });
    await waitFor(() => expect(screen.queryByText('/hook/live')).not.toBeInTheDocument());
  });

  it('empties the list when the stream reports a clear', async () => {
    mockApi({
      'GET /api/info': { body: INFO },
      [LIST]: { body: { items: [summary()], hasMore: false } },
    });

    render(<App />);
    await screen.findByText('/hook/orders');

    emit('cleared', {});

    expect(await screen.findByText(/No requests yet/)).toBeInTheDocument();
  });

  it('reflects the connection state and refetches after a reconnect', async () => {
    const { calls } = mockApi({
      'GET /api/info': { body: INFO },
      [LIST]: { body: { items: [], hasMore: false } },
    });

    render(<App />);
    await screen.findByText(/No requests yet/);
    expect(screen.getByText('Reconnecting…')).toBeInTheDocument();

    act(() => FakeEventSource.instances[0].open());
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(calls.filter((c) => c === LIST)).toHaveLength(1);

    act(() => FakeEventSource.instances[0].fail());
    expect(screen.getByText('Reconnecting…')).toBeInTheDocument();

    act(() => FakeEventSource.instances[0].open());
    await waitFor(() => expect(calls.filter((c) => c === LIST)).toHaveLength(2));
  });
});

describe('deleting', () => {
  it('deletes the selected request', async () => {
    const user = userEvent.setup();
    const { calls } = mockApi({
      'GET /api/info': { body: INFO },
      [LIST]: { body: { items: [summary()], hasMore: false } },
      'GET /api/requests/1': { body: detail() },
      'DELETE /api/requests/1': { status: 204 },
    });

    render(<App />);
    await user.click(await screen.findByText('/hook/orders'));
    await user.click(await screen.findByRole('button', { name: 'Delete request' }));

    expect(await screen.findByText(/No requests yet/)).toBeInTheDocument();
    expect(screen.getByText('Select a request to inspect it.')).toBeInTheDocument();
    expect(calls).toContain('DELETE /api/requests/1');
  });

  it('clears all requests', async () => {
    const user = userEvent.setup();
    const { calls } = mockApi({
      'GET /api/info': { body: INFO },
      [LIST]: { body: { items: [summary()], hasMore: false } },
      'DELETE /api/requests': { body: { deleted: 1 } },
    });

    render(<App />);
    await screen.findByText('/hook/orders');
    await user.click(screen.getByRole('button', { name: 'Clear all' }));

    expect(await screen.findByText(/No requests yet/)).toBeInTheDocument();
    expect(calls).toContain('DELETE /api/requests');
  });

  it('shows an error and keeps the list when clearing fails', async () => {
    const user = userEvent.setup();
    mockApi({
      'GET /api/info': { body: INFO },
      [LIST]: { body: { items: [summary()], hasMore: false } },
      'DELETE /api/requests': {
        status: 500,
        body: { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      },
    });

    render(<App />);
    await screen.findByText('/hook/orders');
    await user.click(screen.getByRole('button', { name: 'Clear all' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Internal server error');
    expect(screen.getByText('/hook/orders')).toBeInTheDocument();
  });
});

describe('patterns view', () => {
  const pattern = {
    id: HASH,
    count: 2,
    firstSeen: '2026-01-01T12:00:00.000Z',
    lastSeen: '2026-01-01T12:05:00.000Z',
    keys: ['event', 'user'],
  };
  const table = {
    id: HASH,
    keys: ['event', 'user'],
    columns: ['event', 'user.name'],
    columnsTruncated: false,
    rows: [
      ['updated', 'bob'],
      ['created', 'ann'],
    ],
    rowMeta: [
      { id: 7, receivedAt: '2026-01-01T12:05:00.000Z' },
      { id: 6, receivedAt: '2026-01-01T12:00:00.000Z' },
    ],
    totalRows: 2,
  };

  it('lists patterns and shows the selected one as a table', async () => {
    const user = userEvent.setup();
    mockApi({
      'GET /api/info': { body: INFO },
      [LIST]: { body: { items: [], hasMore: false } },
      'GET /api/patterns': { body: { patterns: [pattern] } },
      [`GET /api/patterns/${HASH}/table`]: { body: table },
    });

    render(<App />);
    await user.click(screen.getByRole('tab', { name: 'Patterns' }));
    await user.click(await screen.findByText('event, user'));

    expect(await screen.findByRole('columnheader', { name: 'user.name' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'bob' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'ann' })).toBeInTheDocument();
  });

  it('explains when there are no patterns yet', async () => {
    const user = userEvent.setup();
    mockApi({
      'GET /api/info': { body: INFO },
      [LIST]: { body: { items: [], hasMore: false } },
      'GET /api/patterns': { body: { patterns: [] } },
    });

    render(<App />);
    await user.click(screen.getByRole('tab', { name: 'Patterns' }));

    expect(await screen.findByText(/No patterns yet/)).toBeInTheDocument();
  });

  it('opens the source request from a table row', async () => {
    const user = userEvent.setup();
    mockApi({
      'GET /api/info': { body: INFO },
      [LIST]: { body: { items: [summary({ id: 7 })], hasMore: false } },
      'GET /api/patterns': { body: { patterns: [pattern] } },
      [`GET /api/patterns/${HASH}/table`]: { body: table },
      'GET /api/requests/7': { body: detail({ id: 7, path: '/hook/from-pattern' }) },
    });

    render(<App />);
    await user.click(screen.getByRole('tab', { name: 'Patterns' }));
    await user.click(await screen.findByText('event, user'));
    await user.click(await screen.findByRole('button', { name: 'Open request 7' }));

    expect(
      await screen.findByRole('heading', { name: /\/hook\/from-pattern/ }),
    ).toBeInTheDocument();
  });

  it('refetches patterns when a new request arrives', async () => {
    const user = userEvent.setup();
    const { calls } = mockApi({
      'GET /api/info': { body: INFO },
      [LIST]: { body: { items: [], hasMore: false } },
      'GET /api/patterns': { body: { patterns: [] } },
    });

    render(<App />);
    await user.click(screen.getByRole('tab', { name: 'Patterns' }));
    await screen.findByText(/No patterns yet/);
    expect(calls.filter((c) => c === 'GET /api/patterns')).toHaveLength(1);

    emit('request', summary({ id: 9 }));

    await waitFor(() =>
      expect(calls.filter((c) => c === 'GET /api/patterns')).toHaveLength(2),
    );
  });
});

describe('request and response', () => {
  const openFirstRequest = async (user, routes = {}) => {
    mockApi({
      'GET /api/info': { body: INFO },
      [LIST]: { body: { items: [summary()], hasMore: false } },
      'GET /api/requests/1': { body: detail() },
      ...routes,
    });
    render(<App />);
    await user.click(await screen.findByText('/hook/orders'));
    await screen.findByRole('table', { name: 'Request headers' });
  };

  it('shows the reply that was sent next to the request', async () => {
    const user = userEvent.setup();
    await openFirstRequest(user);

    const headers = screen.getByRole('table', { name: 'Response headers' });
    expect(within(headers).getByText('Content-Length')).toBeInTheDocument();
    expect(screen.getByLabelText('Response body (pretty JSON)')).toHaveTextContent(
      '"received": true',
    );
    expect(screen.getByText('Default reply')).toBeInTheDocument();
    expect(screen.getByText('Replied 200 OK')).toBeInTheDocument();
  });

  it('names the rule and delay when a rule produced the reply', async () => {
    const user = userEvent.setup();
    await openFirstRequest(user, {
      'GET /api/requests/1': {
        body: detail({ response: reply({ status: 503, rule: 'Maintenance', delayMs: 250 }) }),
      },
    });

    expect(screen.getByText('Maintenance')).toBeInTheDocument();
    expect(screen.getByText('250 ms')).toBeInTheDocument();
    expect(screen.getByText('Replied 503 Service Unavailable')).toBeInTheDocument();
  });

  it('switches between request, response and both', async () => {
    const user = userEvent.setup();
    await openFirstRequest(user);
    const requestTable = () => screen.queryByRole('table', { name: 'Request headers' });
    const responseTable = () => screen.queryByRole('table', { name: 'Response headers' });

    await user.click(screen.getByRole('tab', { name: 'Response' }));
    expect(requestTable()).not.toBeInTheDocument();
    expect(responseTable()).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Request' }));
    expect(requestTable()).toBeInTheDocument();
    expect(responseTable()).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Both' }));
    expect(requestTable()).toBeInTheDocument();
    expect(responseTable()).toBeInTheDocument();
  });

  it('explains when no reply was recorded for an older request', async () => {
    const user = userEvent.setup();
    await openFirstRequest(user, {
      'GET /api/requests/1': { body: detail({ response: null }) },
    });

    expect(screen.getByText('No reply was recorded for this request.')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Response headers' })).not.toBeInTheDocument();
  });

  it('shows the reply status in the request list', async () => {
    mockApi({
      'GET /api/info': { body: INFO },
      [LIST]: { body: { items: [summary({ responseStatus: 418 })], hasMore: false } },
    });

    render(<App />);

    expect(await screen.findByTitle('Status of the reply sent')).toHaveTextContent('418');
  });
});

describe('replies view', () => {
  const GET_RULES = 'GET /api/reply-rules';

  async function openReplies(user, routes = {}) {
    mockApi({
      'GET /api/info': { body: INFO },
      [LIST]: { body: { items: [], hasMore: false } },
      [GET_RULES]: { body: { rules: [replyRule()] } },
      ...routes,
    });
    render(<App />);
    await user.click(screen.getByRole('tab', { name: 'Replies' }));
  }

  it('lists rules and explains how replies work', async () => {
    const user = userEvent.setup();
    await openReplies(user);

    expect(await screen.findByText('/hook/services/collector*')).toBeInTheDocument();
    expect(screen.getByText('Splunk HEC')).toBeInTheDocument();
    expect(screen.getByText('How replies work')).toBeInTheDocument();
  });

  it('shows the default-reply hint when there are no rules', async () => {
    const user = userEvent.setup();
    await openReplies(user, { [GET_RULES]: { body: { rules: [] } } });

    expect(await screen.findByText(/No rules\. Every request gets the default reply/)).toBeInTheDocument();
  });

  it('loads a rule into the form', async () => {
    const user = userEvent.setup();
    await openReplies(user);

    await user.click(await screen.findByText('/hook/services/collector*'));

    expect(screen.getByLabelText('Name')).toHaveValue('Splunk HEC');
    expect(screen.getByLabelText('Path pattern')).toHaveValue('/hook/services/collector*');
    expect(screen.getByLabelText('Status')).toHaveValue('200');
    expect(screen.getByLabelText('Delay (ms)')).toHaveValue('0');
    expect(screen.getByLabelText('Header name 1')).toHaveValue('Content-Type');
    expect(screen.getByLabelText('Header value 1')).toHaveValue('application/json; charset=UTF-8');
    expect(screen.getByLabelText('Body')).toHaveValue('{"text":"Success","code":0}');
  });

  it('saves edits with a PUT and refreshes the list', async () => {
    const user = userEvent.setup();
    let current = [replyRule()];
    let payload;
    await openReplies(user, {
      [GET_RULES]: () => ({ body: { rules: current } }),
      'PUT /api/reply-rules/1': (options) => {
        payload = JSON.parse(options.body);
        current = [{ id: 1, ...payload }];
        return { body: current[0] };
      },
    });

    await user.click(await screen.findByText('/hook/services/collector*'));
    await user.clear(screen.getByLabelText('Status'));
    await user.type(screen.getByLabelText('Status'), '201');
    await user.clear(screen.getByLabelText('Delay (ms)'));
    await user.type(screen.getByLabelText('Delay (ms)'), '150');
    await user.click(screen.getByRole('button', { name: 'Save rule' }));

    await waitFor(() => expect(payload).toBeDefined());
    expect(payload).toEqual({
      name: 'Splunk HEC',
      pathPattern: '/hook/services/collector*',
      status: 201,
      delayMs: 150,
      headers: [{ name: 'Content-Type', value: 'application/json; charset=UTF-8' }],
      body: '{"text":"Success","code":0}',
    });
    expect(await screen.findByText('150 ms delay')).toBeInTheDocument();
  });

  it('creates a rule with a POST, ignoring blank header rows', async () => {
    const user = userEvent.setup();
    let current = [];
    let payload;
    await openReplies(user, {
      [GET_RULES]: () => ({ body: { rules: current } }),
      'POST /api/reply-rules': (options) => {
        payload = JSON.parse(options.body);
        current = [{ id: 5, ...payload }];
        return { status: 201, body: current[0] };
      },
    });

    await user.click(await screen.findByRole('button', { name: 'New rule' }));
    await user.type(screen.getByLabelText('Name'), 'Teapot');
    await user.clear(screen.getByLabelText('Path pattern'));
    await user.type(screen.getByLabelText('Path pattern'), '/hook/tea*');
    await user.clear(screen.getByLabelText('Status'));
    await user.type(screen.getByLabelText('Status'), '418');
    await user.click(screen.getByRole('button', { name: 'Add header' }));
    expect(screen.getByLabelText('Header name 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save rule' }));

    await waitFor(() => expect(payload).toBeDefined());
    expect(payload).toEqual({
      name: 'Teapot',
      pathPattern: '/hook/tea*',
      status: 418,
      delayMs: 0,
      headers: [{ name: 'Content-Type', value: 'application/json' }],
      body: '',
    });
    expect(await screen.findByText('Teapot')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete rule' })).toBeInTheDocument();
  });

  it('removes a header row', async () => {
    const user = userEvent.setup();
    await openReplies(user);

    await user.click(await screen.findByText('/hook/services/collector*'));
    await user.click(screen.getByRole('button', { name: 'Remove header 1' }));

    expect(screen.queryByLabelText('Header name 1')).not.toBeInTheDocument();
  });

  it('shows validation details from the server and keeps the form', async () => {
    const user = userEvent.setup();
    await openReplies(user, {
      'PUT /api/reply-rules/1': {
        status: 400,
        body: {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: [{ location: 'body', path: 'status', message: 'Number must be less than or equal to 599' }],
          },
        },
      },
    });

    await user.click(await screen.findByText('/hook/services/collector*'));
    await user.clear(screen.getByLabelText('Status'));
    await user.type(screen.getByLabelText('Status'), '700');
    await user.click(screen.getByRole('button', { name: 'Save rule' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('status: Number must be');
    expect(screen.getByLabelText('Status')).toHaveValue('700');
  });

  it('deletes a rule', async () => {
    const user = userEvent.setup();
    let current = [replyRule()];
    const { calls } = mockApi({
      'GET /api/info': { body: INFO },
      [LIST]: { body: { items: [], hasMore: false } },
      [GET_RULES]: () => ({ body: { rules: current } }),
      'DELETE /api/reply-rules/1': () => {
        current = [];
        return { status: 204 };
      },
    });
    render(<App />);
    await user.click(screen.getByRole('tab', { name: 'Replies' }));

    await user.click(await screen.findByText('/hook/services/collector*'));
    await user.click(screen.getByRole('button', { name: 'Delete rule' }));

    expect(await screen.findByText(/No rules\. Every request gets the default reply/)).toBeInTheDocument();
    expect(calls).toContain('DELETE /api/reply-rules/1');
  });

  it('shows an error when the rules cannot be loaded', async () => {
    const user = userEvent.setup();
    await openReplies(user, {
      [GET_RULES]: {
        status: 500,
        body: { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Internal server error');
  });
});
