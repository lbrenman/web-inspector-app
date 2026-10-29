const replyRulesService = require('../services/replyRulesService');

async function list(_req, res) {
  res.json({ rules: await replyRulesService.listRules() });
}

async function create(req, res) {
  res.status(201).json(await replyRulesService.createRule(req.validated.body));
}

async function update(req, res) {
  res.json(await replyRulesService.updateRule(req.validated.params.id, req.validated.body));
}

async function remove(req, res) {
  await replyRulesService.deleteRule(req.validated.params.id);
  res.status(204).end();
}

module.exports = { list, create, update, remove };
