import { useState } from 'react';
import { describeError } from '../api/notesApi.js';

export default function NoteForm({ onCreate }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onCreate({ title, body });
      setTitle('');
      setBody('');
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Title
        <input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label>
        Body
        <textarea
          value={body}
          rows={4}
          maxLength={10000}
          onChange={(e) => setBody(e.target.value)}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? 'Adding…' : 'Add note'}
      </button>
    </form>
  );
}
