export function formatBytes(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatTime(value) {
  return new Date(value).toLocaleTimeString();
}

const STATUS_TEXT = {
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No Content',
  301: 'Moved Permanently',
  302: 'Found',
  304: 'Not Modified',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  418: "I'm a teapot",
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

export function statusText(code) {
  return STATUS_TEXT[code] ?? '';
}

/** 'ok' | 'redirect' | 'client-error' | 'server-error', used to color status codes. */
export function statusClass(code) {
  if (code >= 500) return 'server-error';
  if (code >= 400) return 'client-error';
  if (code >= 300) return 'redirect';
  return 'ok';
}
