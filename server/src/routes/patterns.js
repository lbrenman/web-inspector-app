const express = require('express');
const patternsController = require('../controllers/patternsController');
const validate = require('../middleware/validate');
const { hashParams } = require('../schemas/requestsSchemas');

const router = express.Router();

router.get('/', patternsController.list);
router.get('/:hash/table', validate({ params: hashParams }), patternsController.table);

module.exports = router;
