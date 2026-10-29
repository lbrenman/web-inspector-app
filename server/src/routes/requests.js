const express = require('express');
const requestsController = require('../controllers/requestsController');
const validate = require('../middleware/validate');
const { idParams, listQuery } = require('../schemas/requestsSchemas');

const router = express.Router();

router.get('/', validate({ query: listQuery }), requestsController.list);
router.delete('/', requestsController.clear);
router.get('/:id', validate({ params: idParams }), requestsController.get);
router.delete('/:id', validate({ params: idParams }), requestsController.remove);

module.exports = router;
