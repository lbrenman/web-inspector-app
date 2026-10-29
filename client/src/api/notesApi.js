export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server');
  }

  if (response.status === 204) {
    return null;
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // Non-JSON response; handled below.
  }

  if (!response.ok) {
    const error = payload?.error;
    throw new ApiError(
      response.status,
      error?.code ?? 'UNKNOWN_ERROR',
      error?.message ?? `Request failed (${response.status})`,
      error?.details,
    );
  }

  return payload;
}

/** Human-readable message for an error thrown by this module (includes validation details). */
export function describeError(err) {
  if (err instanceof ApiError && Array.isArray(err.details) && err.details.length > 0) {
    return err.details.map((d) => `${d.path}: ${d.message}`).join('; ');
  }
  return err instanceof Error ? err.message : 'Something went wrong';
}

export function listNotes() {
  return request('/notes');
}

export function createNote(note) {
  return request('/notes', { method: 'POST', body: JSON.stringify(note) });
}

export function deleteNote(id) {
  return request(`/notes/${id}`, { method: 'DELETE' });
}
