const express = require('express');
const healthController = require('../controllers/healthController');
const infoController = require('../controllers/infoController');
const streamController = require('../controllers/streamController');
const patternsRoutes = require('./patterns');
const replyRulesRoutes = require('./replyRules');
const requestsRoutes = require('./requests');

// Inspector API routes (mounted under /api). Never mounted on the public capture app.
const router = express.Router();

router.get('/health', healthController.check);
router.get('/info', infoController.get);
router.get('/stream', streamController.stream);
router.use('/requests', requestsRoutes);
router.use('/patterns', patternsRoutes);
router.use('/reply-rules', replyRulesRoutes);

module.exports = router;
