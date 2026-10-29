import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.jsx';
import { detail, FakeEventSource, INFO, mockApi, summary } from './test/helpers.js';

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

    const headers = await screen.findByRole('table', { name: 'Headers' });
    expect(within(headers).getByText('X-Api-Key')).toBeInTheDocument();
    expect(within(headers).getByText('secret-123')).toBeInTheDocument();

    const query = screen.getByRole('table', { name: 'Query parameters' });
    expect(within(query).getByText('postman')).toBeInTheDocument();
    expect(screen.getByText(/"hello": "world"/)).toBeInTheDocument();
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
