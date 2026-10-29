import { vi } from 'vitest';

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Routes fetch calls by "METHOD /url". A route is { status?, body } or a function returning one.
 * Unmocked requests reject, which the API layer reports as a network error.
 */
export function mockApi(routes) {
  const calls = [];
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options = {}) => {
    const key = `${options.method ?? 'GET'} ${url}`;
    calls.push(key);

    const route = routes[key];
    if (!route) {
      throw new Error(`Unmocked request: ${key}`);
    }

    const { status = 200, body } = typeof route === 'function' ? route(options) : route;
    return status === 204 ? new Response(null, { status }) : jsonResponse(body, status);
  });
  return { spy, calls };
}

/** Minimal EventSource stand-in: tests drive it with open() and emit(). */
export class FakeEventSource {
  static instances = [];

  constructor(url) {
    this.url = url;
    this.listeners = {};
    this.closed = false;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type, listener) {
    (this.listeners[type] ??= []).push(listener);
  }

  close() {
    this.closed = true;
  }

  open() {
    this.onopen?.();
  }

  fail() {
    this.onerror?.();
  }

  emit(type, data) {
    (this.listeners[type] ?? []).forEach((listener) => listener({ data: JSON.stringify(data) }));
  }
}

export const INFO = {
  captureUrl: 'https://capture.example.test/hook',
  maxBodyBytes: 1048576,
  maxStoredRequests: 1000,
};

export const summary = (overrides = {}) => ({
  id: 1,
  receivedAt: '2026-01-01T12:00:00.000Z',
  method: 'POST',
  path: '/hook/orders',
  queryString: '',
  contentType: 'application/json',
  bodySize: 17,
  isJson: true,
  responseStatus: 200,
  ...overrides,
});

export const reply = (overrides = {}) => ({
  status: 200,
  rule: null,
  delayMs: 0,
  headers: [
    { name: 'Content-Type', value: 'application/json; charset=utf-8' },
    { name: 'Content-Length', value: '25' },
  ],
  body: { encoding: 'utf8', size: 25, text: '{"received":true,"id":1}', isJson: true },
  ...overrides,
});

export const replyRule = (overrides = {}) => ({
  id: 1,
  name: 'Splunk HEC',
  pathPattern: '/hook/services/collector*',
  status: 200,
  headers: [{ name: 'Content-Type', value: 'application/json; charset=UTF-8' }],
  body: '{"text":"Success","code":0}',
  delayMs: 0,
  ...overrides,
});

export const detail = (overrides = {}) => ({
  id: 1,
  receivedAt: '2026-01-01T12:00:00.000Z',
  method: 'POST',
  path: '/hook/orders',
  queryString: 'source=postman',
  httpVersion: '1.1',
  remoteAddress: '127.0.0.1',
  headers: [
    { name: 'Content-Type', value: 'application/json' },
    { name: 'X-Api-Key', value: 'secret-123' },
  ],
  query: [{ name: 'source', value: 'postman' }],
  body: { encoding: 'utf8', size: 17, text: '{"hello":"world"}', isJson: true },
  tables: [],
  response: reply(),
  ...overrides,
});
