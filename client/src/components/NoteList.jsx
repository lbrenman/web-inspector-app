export default function NoteList({ notes, onDelete }) {
  if (notes.length === 0) {
    return <p>No notes yet.</p>;
  }

  return (
    <ul>
      {notes.map((note) => (
        <li key={note.id}>
          <h3>{note.title}</h3>
          <p>{note.body}</p>
          <button
            type="button"
            aria-label={`Delete ${note.title}`}
            onClick={() => onDelete(note.id)}
          >
            Delete
          </button>
        </li>
      ))}
    </ul>
  );
}
