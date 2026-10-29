const healthService = require('../services/healthService');

async function check(_req, res) {
  res.json(await healthService.check());
}

module.exports = { check };
