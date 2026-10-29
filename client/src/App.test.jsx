import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from './App.jsx';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const note = (overrides = {}) => ({
  id: 1,
  title: 'First note',
  body: 'First body',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('App', () => {
  it('shows a loading state, then the notes', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse([note()]));

    render(<App />);

    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(await screen.findByText('First note')).toBeInTheDocument();
    expect(screen.getByText('First body')).toBeInTheDocument();
  });

  it('shows an empty state when there are no notes', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse([]));

    render(<App />);

    expect(await screen.findByText('No notes yet.')).toBeInTheDocument();
  });

  it('shows an error when the notes cannot be loaded', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));

    render(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server');
  });

  it('shows the server message when loading fails with an API error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }, 500),
    );

    render(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Internal server error');
  });

  it('creates a note, shows it first, and clears the form', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse([note()]))
      .mockResolvedValueOnce(
        jsonResponse(note({ id: 2, title: 'New title', body: 'New body' }), 201),
      );

    render(<App />);
    await screen.findByText('First note');

    await user.type(screen.getByLabelText('Title'), 'New title');
    await user.type(screen.getByLabelText('Body'), 'New body');
    await user.click(screen.getByRole('button', { name: 'Add note' }));

    expect(await screen.findByText('New title')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/notes',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ title: 'New title', body: 'New body' }),
      }),
    );
    await waitFor(() => {
      expect(screen.getByLabelText('Title')).toHaveValue('');
      expect(screen.getByLabelText('Body')).toHaveValue('');
    });

    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(titles).toEqual(['New title', 'First note']);
  });

  it('shows validation details from the server and keeps the typed values', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Request validation failed',
              details: [
                { location: 'body', path: 'title', message: 'String must contain at least 1 character(s)' },
              ],
            },
          },
          400,
        ),
      );

    render(<App />);
    await screen.findByText('No notes yet.');

    await user.type(screen.getByLabelText('Body'), 'Only a body');
    await user.click(screen.getByRole('button', { name: 'Add note' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('title: String must contain');
    expect(screen.getByLabelText('Body')).toHaveValue('Only a body');
    expect(screen.getByText('No notes yet.')).toBeInTheDocument();
  });

  it('deletes a note', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse([note()]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    render(<App />);
    await screen.findByText('First note');

    await user.click(screen.getByRole('button', { name: /delete first note/i }));

    await waitFor(() => expect(screen.queryByText('First note')).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/notes/1',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(screen.getByText('No notes yet.')).toBeInTheDocument();
  });

  it('keeps the note and shows an error when deleting fails', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse([note()]))
      .mockResolvedValueOnce(
        jsonResponse({ error: { code: 'NOT_FOUND', message: 'Note not found' } }, 404),
      );

    render(<App />);
    await screen.findByText('First note');

    await user.click(screen.getByRole('button', { name: /delete first note/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Note not found');
    expect(screen.getByText('First note')).toBeInTheDocument();
  });
});
