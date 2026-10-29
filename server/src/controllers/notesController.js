const notesService = require('../services/notesService');

async function list(req, res) {
  res.json(await notesService.listNotes(req.validated.query));
}

async function get(req, res) {
  res.json(await notesService.getNote(req.validated.params.id));
}

async function create(req, res) {
  const note = await notesService.createNote(req.validated.body);
  res.status(201).json(note);
}

async function remove(req, res) {
  await notesService.deleteNote(req.validated.params.id);
  res.status(204).end();
}

module.exports = { list, get, create, remove };
