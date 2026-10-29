const express = require('express');
const healthRoutes = require('./health');
const notesRoutes = require('./notes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/notes', notesRoutes);

module.exports = router;
