const HttpError = require('../errors/HttpError');
const notesRepository = require('../db/notesRepository');

function notFound() {
  return new HttpError(404, 'NOT_FOUND', 'Note not found');
}

async function listNotes({ limit, offset }) {
  return notesRepository.list({ limit, offset });
}

async function getNote(id) {
  const note = await notesRepository.findById(id);
  if (!note) throw notFound();
  return note;
}

async function createNote({ title, body }) {
  return notesRepository.create({ title, body });
}

async function deleteNote(id) {
  const deleted = await notesRepository.deleteById(id);
  if (!deleted) throw notFound();
}

module.exports = { listNotes, getNote, createNote, deleteNote };
