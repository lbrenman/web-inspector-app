const patternsService = require('../services/patternsService');

async function list(_req, res) {
  res.json({ patterns: await patternsService.listPatterns() });
}

async function table(req, res) {
  res.json(await patternsService.getPatternTable(req.validated.params.hash));
}

module.exports = { list, table };
