import { useEffect, useState } from 'react';
import { createNote, deleteNote, describeError, listNotes } from './api/notesApi.js';
import NoteForm from './components/NoteForm.jsx';
import NoteList from './components/NoteList.jsx';

export default function App() {
  const [notes, setNotes] = useState([]);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    listNotes()
      .then((data) => {
        if (cancelled) return;
        setNotes(data);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(describeError(err));
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Errors are rethrown so NoteForm can show them next to the form.
  async function handleCreate(note) {
    const created = await createNote(note);
    setNotes((prev) => [created, ...prev]);
  }

  async function handleDelete(id) {
    setActionError(null);
    try {
      await deleteNote(id);
      setNotes((prev) => prev.filter((note) => note.id !== id));
    } catch (err) {
      setActionError(describeError(err));
    }
  }

  return (
    <main>
      <h1>Notes</h1>
      <NoteForm onCreate={handleCreate} />
      {actionError && <p role="alert">{actionError}</p>}
      {status === 'loading' && <p>Loading…</p>}
      {status === 'error' && <p role="alert">{loadError}</p>}
      {status === 'ready' && <NoteList notes={notes} onDelete={handleDelete} />}
    </main>
  );
}
