const express = require('express');
const config = require('../config');
const captureController = require('../controllers/captureController');

const router = express.Router();

// Accept any content type and keep the bytes untouched. Oversized bodies are rejected (413).
const rawBody = express.raw({ type: () => true, limit: config.maxBodyBytes });

router.all(['/hook', '/hook/*splat'], rawBody, captureController.capture);

module.exports = router;
