const requestsService = require('../services/requestsService');

async function list(req, res) {
  res.json(await requestsService.listRequests(req.validated.query));
}

async function get(req, res) {
  res.json(await requestsService.getRequest(req.validated.params.id));
}

async function remove(req, res) {
  await requestsService.deleteRequest(req.validated.params.id);
  res.status(204).end();
}

async function clear(_req, res) {
  res.json({ deleted: await requestsService.clearRequests() });
}

module.exports = { list, get, remove, clear };
