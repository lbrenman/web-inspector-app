const express = require('express');
const notesController = require('../controllers/notesController');
const validate = require('../middleware/validate');
const { idParams, listQuery, createBody } = require('../schemas/notesSchemas');

const router = express.Router();

router.get('/', validate({ query: listQuery }), notesController.list);
router.post('/', validate({ body: createBody }), notesController.create);
router.get('/:id', validate({ params: idParams }), notesController.get);
router.delete('/:id', validate({ params: idParams }), notesController.remove);

module.exports = router;
